/**
 * Deploy as a Google Apps Script web app executing as the dedicated sender.
 * Store WEBHOOK_SECRET in Script Properties. The URL is called only by the
 * authenticated Supabase Edge Function.
 */
function doPost(event) {
  try {
    const request = JSON.parse(event.postData.contents)
    const secret = PropertiesService.getScriptProperties().getProperty('WEBHOOK_SECRET')
    if (!secret) return response({ ok: false, error: 'Sender is not configured' })

    const timestamp = Number(request.timestamp)
    if (!Number.isFinite(timestamp) || Math.abs(Date.now() - timestamp) > 5 * 60 * 1000) {
      return response({ ok: false, error: 'Request expired' })
    }
    if (typeof request.nonce !== 'string' || typeof request.payload !== 'string') {
      return response({ ok: false, error: 'Invalid request' })
    }

    const cache = CacheService.getScriptCache()
    if (cache.get(request.nonce)) return response({ ok: false, error: 'Request already used' })
    const message = request.timestamp + '.' + request.nonce + '.' + request.payload
    const expected = toHex(Utilities.computeHmacSha256Signature(message, secret))
    if (!safeEqual(expected, String(request.signature || ''))) {
      return response({ ok: false, error: 'Invalid signature' })
    }

    const email = JSON.parse(request.payload)
    if (!email.to || !email.subject || !email.textBody || !email.htmlBody) {
      return response({ ok: false, error: 'Invalid email payload' })
    }
    if (MailApp.getRemainingDailyQuota() < 1) {
      return response({ ok: false, error: 'Daily email quota reached' })
    }

    cache.put(request.nonce, 'used', 600)
    MailApp.sendEmail({
      to: email.to,
      subject: email.subject,
      body: email.textBody,
      htmlBody: email.htmlBody,
      name: 'Woody Friends',
    })
    return response({ ok: true, deliveryId: email.deliveryId })
  } catch (error) {
    console.error(error)
    return response({ ok: false, error: 'Could not send email' })
  }
}

function toHex(bytes) {
  return bytes.map(function (byte) {
    const unsigned = byte < 0 ? byte + 256 : byte
    return ('0' + unsigned.toString(16)).slice(-2)
  }).join('')
}

function safeEqual(left, right) {
  if (left.length !== right.length) return false
  let mismatch = 0
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index)
  }
  return mismatch === 0
}

function response(body) {
  return ContentService
    .createTextOutput(JSON.stringify(body))
    .setMimeType(ContentService.MimeType.JSON)
}
