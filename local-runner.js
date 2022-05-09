#!/usr/bin/env node

const { loadSharedConfigFiles } = require('@aws-sdk/shared-ini-file-loader')

require('dotenv').config()

const profile = process.env.AWS_PROFILE || process.env.USER

async function run () {
  const config = await loadSharedConfigFiles()

  const conf = config.configFile[profile]
  const cred = config.credentialsFile[profile]

  global.AWS_CONFIG = {
    credentials: {
      accessKeyId: cred.aws_access_key_id,
      secretAccessKey: cred.aws_secret_access_key
    },
    region: process.env.AWS_REGION || conf.region
  }

  const { handler } = require('./index')

  await handler({
    date: process.env.PARAM_DATE || getDate(),
    userAgent: process.env.PARAM_USER_AGENT
  })
}

function getDate () {
  return new Date()
    .toLocaleDateString('ja-JP', {
      dateStyle: 'short',
      timeZone: 'Asia/Tokyo'
    })
    .replace(/\//g, '-')
}

run()
