# yumebokujo-checker

> Notify availability of a reservation site

This is a Node.js Lambda code that checks for availability on the [Narita Yume-bokujo Campground reservation site] and notifies when there is an opening.

## Architecture

```
┌────────────────────┐                   ┌──────────────────────────┐
│                    │                   │                          │
│ Amazon EventBridge ├── Trigger Event ──► AWS Lambda (Node.js v14) │
│                    │                   │                          │
└────────────────────┘                   └─────────────┬────────────┘
                                                       │
            ┌───────────┐                              │
            │           ├── GetObject calendar.json ──►│                 ┌──────────────────┐
            │           │                              │                 │                  │
            │ Amazon S3 │                              │◄── node-fetch ──┤ Reservation Site │
            │           │                              │                 │                  │
            │           ◄── PutObject calendar.json ───┤                 └──────────────────┘
            └───────────┘                              │
                                                       │
                                        ┌──────────────▼─────────────┐
                                        │                            │
                                        │ IFTTT Webhooks integration │
                                        │                            │
                                        └──────────────┬─────────────┘
                                                       │
                                                       ▼
                                            Notify your own applet
```

## Prerequisites

* You need your AWS account and have your profile set up locally.
* Prepare an S3 bucket to store the previous state.
* Get the endpoint key for the [IFTTT Webhooks integrations] in order to receive notifications.
* Configure the IFTTT applets to receive notifications when the IFTTT Webhooks integrations is invoked.
* To run `npm run pack` command, the local `zip` command is required.

## How to setup locally

1. Clone this repository.
2. Copy and paste `.template.env` file and rename the file to `.env`.
3. Fill in the `.env` file.

## How to setup Lambda and EventBridge

1. Create an AWS Lambda with Node.js `v14.x` runtime.
2. Add environment variables.

| Variable | Description | Required |
|---|---|---|
| `AWS_S3_BUCKET` | An S3 bucket to store availability results. | Yes |
| `AWS_S3_OBJECT_KEY` | A file name to store data in the S3 bucket above. | No |
| `IFTTT_WEBHOOKS_EVENT_NAME` | An IFTTT Webhooks integration event name. | Yes |
| `IFTTT_WEBHOOKS_KEY` | Your key of IFTTT Webhooks integrations. | Yes |

3. Create an Amazon EventBridge rule.
   * Configure target to Lambda function, and select the Lambda function created above.
   * Choose `Constant (JSON text)` as target input, and edit JSON string like follows:
      ```json
      {
        "date": "2022-06-01",
        "userAgent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:99.0) Gecko/20100101 Firefox/99.0"
      }
      ```

## Commands

### Local execution

Runs locally.  
No deployment to AWS Lambda is required.  
This command requires the `.env` file and local AWS profiles to run.

```shell
npm run test
```

### Create Zip file for Lambda

Create a Zip file to deploy to AWS Lambda.  
In the process of creating the Zip file, the `node_modules` folder will be removed for production installation.

```shell
npm run pack
```

You can safely upload `package.zip` to AWS Lambda (using AWS Console).

## License

MIT

[Narita Yume-bokujo Campground reservation site]: https://yumebokujo.revn.jp/camp/
[IFTTT Webhooks integrations]: https://ifttt.com/maker_webhooks
