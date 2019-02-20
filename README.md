# NO ME PUEDO CREER QUE PUEDA HACER UNA APLICACIÓN SERVERLESS EN DOS HORAS

## Paso 3 - Darse de alta en un master y notificar a la universidad

Es hora de poder darse de alta en uno de estos maravillosos masters. Lo que vamos a querer es que cuando me llegue una petición para darse de alta a un master notifiquemos por correo electrónico a la universidad que dicha petición ha llegado. Pero a la vez, no queremos que el hecho de enviar un correo electrónico repercuta en el rendimiento de mi endpoint, con lo que vamos a desacoplar ambas cosas en dos funciones que se van a comunicar por un evento. Para los eventos, vamos a utilizar SNS y para el envío de correo vamos a utilizar SES.

Empecemos definiendo en el archivo `serverless.yml` nuestra nueva función de enroll:
```
enrollMaster:
  handler: src/functions/enrollMaster.handler
  events:
    - http:
        path: api/masters
        method: post
  environment:
    enrollMasterSnsTopic: ${self:custom.enrolMasterSnsTopic}
  iamRoleStatements:
    - Effect: Allow
      Action: sns:Publish
      Resource: ${self:custom.enrolMasterSnsTopic}
```

La diferencia con la anterior función es que ahora utilizaremos un POST, que debemos dar permisos a la función para poder poner un mensaje en un topic de SNS y que necesitamos el arn del topic de SNS como variable de entorno. Como ves, necesitamos definir un par de nuevas variables en la sección custom. Debería ser algo así:
```
enrolMasterSnsTopicName: enrollMasterEvents-${self:custom.stage}
enrolMasterSnsTopic: arn:aws:sns:#{AWS::Region}:#{AWS::AccountId}:${self:custom.enrolMasterSnsTopicName}
```

Nos falta ahora crear la función. Crear un nuevo archivo llamado enrollMaster.js en la carpeta de las funciones con el siguiente contenido:
```
const AWS = require("aws-sdk");
const chance = require("chance").Chance();
const sns = new AWS.SNS();

module.exports.handler = async event => {
  console.log(event.body);
  const { masterId } = JSON.parse(event.body);

  const orderId = chance.guid();
  console.log(`enrolling to master ${masterId} with order ID ${orderId}`);

  const data = {
    orderId,
    masterId
  };

  const params = {
    Message: JSON.stringify(data),
    TopicArn: process.env.enrollMasterSnsTopic
  };

  await sns.publish(params).promise();

  console.log(`published 'master_enrolled' event into Kinesis`);

  const response = {
    statusCode: 200,
    body: JSON.stringify({ orderId })
  };

  return response;
};
```

Lo que estamos haciendo es capturar la variable masterId que el usuario nos pasará en el body de la petición, crear un nuevo guid con la librería `chance` y crear e insertar un evento en SNS. Al usuario le devolvemos el `orderId`.

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
    - sns: ${self:custom.enrolMasterSnsTopicName}
  environment:
    emailAddress: xxxx@yyyy.com
  iamRoleStatements:
    - Effect: Allow
      Action: 
        - ses:SendEmail
        - ses:SendRawEmail
      Resource: "*"
```

La gran novedad aquí es que no será una función llamada via HTTP, sinó que será llamada por un mensaje en un stream. En cuanto a los permisos, necesitamos permiso para enviar el correo y para poner un nuevo mensaje en el stream para indicar que hemos enviado la notificación. Vamos a ver pues el código de la función:
```
/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */
const AWS = require("aws-sdk");
const ses = new AWS.SES();
const { emailAddress } = process.env;

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
  const orderPlaced = JSON.parse(event.Records[0].Sns.Message);
  console.log(orderPlaced);

  const emailParams = generateEmail(orderPlaced.orderId, orderPlaced.masterId);
  await ses.sendEmail(emailParams).promise();

  console.log(
    `notified universtity of order [${orderPlaced.orderId}] for master [${
      orderPlaced.masterId
    }]`
  );

  return "all done";
};

```

El evento de SNS nos viene en el evento que recibimos por parte de AWS, y le hemos añadido enviar el correo via SES, que como ves, no tiene mucho secreto.

Ahora, si haces otra vez el post que hemos hecho anteriormente, deberías recibir un correo con el id del master y el id de la orden.
