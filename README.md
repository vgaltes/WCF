# NO ME PUEDO CREER QUE PUEDA HACER UNA APLICACIÓN SERVERLESS EN DOS HORAS

## Paso 3 - Darse de alta en un master y notificar a la universidad

Es hora de poder darse de alta en uno de estos maravillosos masters. Lo que vamos a querer es que cuando me llegue una petición para darse de alta a un master notifiquemos por correo electrónico a la universidad que dicha petición ha llegado. Pero a la vez, no queremos que el hecho de enviar un correo electrónico repercuta en el rendimiento de mi endpoint, con lo que vamos a desacoplar ambas cosas en dos funciones que se van a comunicar por un evento. Para los eventos, vamos a utilizar Kinesis Streams y para el envío de correo vamos a utilizar SES.

Empecemos definiendo en el archivo `serverless.yml` nuestra nueva función de enroll:
```
enrollMaster:
  handler: src/functions/enrollMaster.handler
  events:
    - http:
        path: api/masters
        method: post
  environment:
    enrollMasterEventsStream: ${self:custom.enrollMasterEventsStream}
  iamRoleStatements:
    - Effect: Allow
      Action: kinesis:PutRecord
      Resource: arn:aws:kinesis:#{AWS::Region}:#{AWS::AccountId}:stream/${self:custom.enrollMasterEventsStream}
```

La diferencia con la anterior función es que ahora utilizaremos un POST, que debemos dar permisos a la función para poder poner un mensaje en el event stream y que necesitamos el nombre del event stream como variable de entorno. Como ves, necesitamos definir una nueva variable en la sección custom. Debería ser algo así:
```
enrollMasterEventsStream: enrollMasterEvents-${self:custom.stage}
```

Nos falta ahora crear la función. Crear un nuevo archivo llamado enrollMaster.js en la carpeta de las funciones con el siguiente contenido:
```
const AWS = require("aws-sdk");
const chance = require("chance").Chance();

const kinesis = new AWS.Kinesis();
const eventStream = process.env.enrollMasterEventsStream;

module.exports.handler = async event => {
  console.log(event.body);
  const { masterId } = JSON.parse(event.body);

  const orderId = chance.guid();
  console.log(`enrolling to master ${masterId} with order ID ${orderId}`);

  const data = {
    orderId,
    masterId,
    eventType: "master_enrolled"
  };

  const req = {
    Data: JSON.stringify(data), // the SDK would base64 encode this for us
    PartitionKey: orderId,
    StreamName: eventStream
  };

  await kinesis.putRecord(req).promise();

  console.log(`published 'master_enrolled' event into Kinesis`);

  const response = {
    statusCode: 200,
    body: JSON.stringify({ orderId })
  };

  return response;
};
```

Lo que estamos haciendo es capturar la variable masterId que el usuario nos pasará en el body de la petición, crear un nuevo guid con la librería `chance` y crear e insertar un evento de tipo `master_enrolled` en kinesis. Al usuario le devolvemos el `orderId`.

Podemos deployar esto 
```
SLSUSER=manolete npm run deploy
```

y hacer una petición post con nuestra herramienta favorita con un body como este:
```
{
  "masterId": "3"
}
```

La petición debería ser satisfactoria y deberíamos recibir el orderId como respuesta.

Vamos ahora a enviar el correo a la universidad. Lo primero que necesitamos hacer es especificarle a SES una dirección verificada. Ve al a consola de AWS y selecciona el servicio `Simple Email Service`. En el menú de la izquierda, selecciona `Email Addresses` en la sección Identity Managemnt. Clica en `Verify a New Email Address` e introduce tu dirección de correo. Recibirás allí un correo con un link para verificarlo, haz clic en el link.

Una vez hecho esto ya podremos enviar mensajes desde y a esa dirección. 

Vamos a definir la función en el fichero `serverless.yml`:
```
notifyUniversity:
  handler: src/functions/notifyUniversity.handler
  events:
    - stream:
        arn: arn:aws:kinesis:#{AWS::Region}:#{AWS::AccountId}:stream/${self:custom.enrollMasterEventsStream}
  environment:
    enrollMasterEventsStream: ${self:custom.enrollMasterEventsStream}
    emailAddress: "xxxx@yyyy.com"
  iamRoleStatements:
    - Effect: Allow
      Action: 
        - ses:SendEmail
        - ses:SendRawEmail
      Resource: "*"
    - Effect: Allow
      Action: kinesis:PutRecord
      Resource: arn:aws:kinesis:#{AWS::Region}:#{AWS::AccountId}:stream/${self:custom.enrollMasterEventsStream}
```

La gran novedad aquí es que no será una función llamada via http, sinó que será llamada por un mensaje en un stream. En cuanto a los permisos, necesitamos permiso para enviar el correo y para poner un nuevo mensaje en el stream para indicar que hemos enviado la notificación. Vamos a ver pues el código de la función:
```
/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */
const AWS = require("aws-sdk");
const _ = require("lodash");

const ses = new AWS.SES();
const kinesis = new AWS.Kinesis();
const eventStream = process.env.enrollMasterEventsStream;
const { emailAddress } = process.env;

function parsePayload(record) {
  const json = Buffer.from(record.kinesis.data, "base64").toString("utf8");
  return JSON.parse(json);
}

function getRecords(event) {
  return event.Records.map(parsePayload);
}

function generateEmail(orderId, masterId) {
  return {
    Source: emailAddress,
    Destination: { ToAddresses: [emailAddress] },
    ReplyToAddresses: [emailAddress],
    Message: {
      Body: {
        Text: {
          Charset: "UTF-8",
          Data: `User has enrolled to master ${masterId} with order id ${orderId}`
        }
      },
      Subject: {
        Charset: "UTF-8",
        Data: `[PufoUniversity] new enrollment`
      }
    }
  };
}

module.exports.handler = async event => {
  const records = getRecords(event);
  console.log(JSON.stringify(records));
  const orderPlaced = records.filter(r => r.eventType === "master_enrolled");

  for (const order of orderPlaced) {
    const emailParams = generateEmail(order.orderId, order.masterId);
    await ses.sendEmail(emailParams).promise();

    console.log(
      `notified universtity of order [${order.orderId}] for master [${
      order.masterId
      }]`
    );

    const data = _.clone(order);
    data.eventType = "university_notified";

    const kinesisReq = {
      Data: JSON.stringify(data), // the SDK would base64 encode this for us
      PartitionKey: order.orderId,
      StreamName: eventStream
    };

    await kinesis.putRecord(kinesisReq).promise();
    console.log(`published 'university_notified' event to Kinesis`);
  }

  return "all done";
};

```

La parte de Kinesis es la misma que ya habíamos visto, y le hemos añadido enviar el correo via SES, que como ves, no tiene mucho secreto.

Ahora, si haces otra vez el post que hemos hecho anteriormente, deberías recibir un correo con el id del master y el id de la orden.
