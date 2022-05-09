const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3')
const fetch = require('node-fetch')
const { parse } = require('node-html-parser')

const bucketParams = {
  Bucket: process.env.AWS_S3_BUCKET,
  Key: process.env.AWS_S3_OBJECT_KEY || 'calendar.json'
}

const awsConfig = global.AWS_CONFIG || {
  region: process.env.AWS_REGION
}

/**
 * @param {string} dateLike
 * @returns {string}
 */
function firstDayOfMonth (dateLike) {
  return `${dateLike.substring(0, 8)}01`
}

/**
 * @param {string} dateLike YYYY-MM-DD
 * @returns {Date}
 */
function toDate (dateLike) {
  return isDate(dateLike)
    ? new Date(`${dateLike}T00:00:00.000+09:00`)
    : new Date(undefined) // Invalid Date
}

/**
 * @param {string} dateLike
 * @returns {boolean}
 */
function isDate (dateLike) {
  return /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(dateLike)
}

/**
 * @param {{
 *   date: string
 *   userAgent: string
 * }} event
 */
exports.handler = async (event) => {
  if (!event.userAgent) {
    console.error('Lambda trigger event parameter: event.userAgent is required')

    return
  }

  if (!event.date || !isDate(event.date)) {
    console.error('Lambda trigger event parameter: event.date should be YYYY-MM-DD')

    return
  }

  const targetDate = toDate(event.date).getTime()

  if (isNaN(targetDate)) {
    console.error('Lambda trigger event parameter: event.date is not valid')

    return
  }

  if (targetDate < Date.now()) {
    console.log('Lambda trigger event parameter: event.date is a date in the past')

    return
  }

  const firstDate = firstDayOfMonth(event.date)

  const response = await fetch(
    `https://yumebokujo.revn.jp/camp/reserve/calendar?date=${firstDate}&reserve=1`,
    {
      headers: {
        'User-Agent': event.userAgent
      }
    }
  )

  const body = await response.text()
  const root = parse(body)

  const data = root
    .querySelectorAll('input[type="hidden"].js_popup_data')
    .map((elm) => {
      /**
       * @type {{
       *   id: string
       *   date: string
       *   time: string
       *   can_reserve: boolean
       *   is_vacant: boolean
       *   reserve_select: null
       *   is_reserved: boolean
       *   reserve_id: string | null
       * }}
       */
      const data = JSON.parse(elm.attributes.value)
      const text = elm.parentNode.textContent

      return {
        available: Number.parseInt(text.replace(/[^0-9]/g, '')),
        canReserve: data.can_reserve,
        date: data.date,
        text
      }
    })

  const dataOfTargetDate = data.filter(item => item.date === event.date)

  console.log('Found target date:', dataOfTargetDate)

  const available = dataOfTargetDate.filter(item => item.canReserve)

  console.log('Found available:', available)

  const s3 = new S3Client(awsConfig)

  /**
   * @type {typeof available}
   */
  let current = []

  try {
    const body = await s3.send(new GetObjectCommand(bucketParams))

    const response2 = new fetch.Response(body.Body)

    current = JSON.parse(await response2.text())
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error)
  }

  try {
    await s3.send(new PutObjectCommand(Object.assign({
      Body: JSON.stringify(available)
    }, bucketParams)))
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error)
  }

  const filtered = available.filter(item => !current.some((other) => {
    return item.available <= other.available &&
      item.canReserve === other.canReserve &&
      item.date === other.date &&
      item.text === other.text
  }))

  console.log('Updates:', filtered)

  if (filtered.length > 0) {
    const format = new Intl.DateTimeFormat('ja-JP', {
      day: 'numeric',
      month: 'long',
      timeZone: 'Asia/Tokyo'
    })
    const msg = [
      '成田ゆめ牧場ファミリーオートキャンプ場に空きが出ました。',
      'https://yumebokujo.revn.jp/camp/reserve/calendar'
    ].concat(filtered.map(item => `${format.format(toDate(item.date))} ${item.text}`))

    /**
     * IFTTT Webhooks integrations
     * @see https://ifttt.com/maker_webhooks
     */
    await fetch(
      `https://maker.ifttt.com/trigger/${process.env.IFTTT_WEBHOOKS_EVENT_NAME}/with/key/${process.env.IFTTT_WEBHOOKS_KEY}`,
      {
        body: JSON.stringify({
          value1: msg.join('<br>')
        }),
        headers: {
          'Content-Type': 'application/json'
        },
        method: 'POST'
      }
    )
  }

  const ret = {
    body: filtered.length,
    statusCode: 200
  }

  return ret
}
