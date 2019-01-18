# NO ME PUEDO CREER QUE PUEDA HACER UNA APLICACIÓN SERVERLESS EN DOS HORAS

## Paso 5 - Autenticación

Es hora de añadir un poco de seguridad a nuestros endpoints. No queremos que cualquiera se pueda dar de alta en nuestra universidad!! Para hacerlo, vamas a utilizar Cognito, en concreto las Cognito User Pools. Las Cognito user pools se encargan de todo lo relacionado con el alta/logueo/deslogueo de un usario. 

Para mostrar como funciona, vamos a introducir un nuevo endpoint que recuperará el detalle de un máster. Empecemos por el test. Crear un archivo llamado `getMasterDetails.spec.js` en la carpeta `tests` con el siguiente contenido:
```
const when = require("./steps/when");
const given = require("./steps/given");
const { init } = require("./steps/init");

describe(`Given an authenticated user`, () => {
  beforeEach(() => {
    init();
  });

  describe(`When we invoke the GET /master/{id} endpoint`, () => {
    test(`Should return the details of the master`, async () => {
      const user = await given.an_authenticated_user();
      const res = await when.we_invoke_get_master_details(user, 1);

      expect(res.statusCode).toBe(200);
      expect(res.body.id).toBe(1);
      expect(res.body).toHaveProperty("name");
      expect(res.body).toHaveProperty("description");
    });
  });
});
```

Nada en especial. Recuperamos un máster y comprobamos que sea el que queremos. Como ves, estamos utilzando una nueva función del módulo `when.js`, así que tendremos que añadirla. Ves al fichero `when.js` y añade la siguiente función:
```
module.exports.we_invoke_get_master_details = (user, masterId) => {
  const event = { pathParameters: { id: masterId } };

  return mode === "http"
    ? viaHttp(`master/${masterId}`, "GET", user.idToken)
    : viaHandler("getMaster", event);
};
```

En este caso, la llamada la haremos a una "sub-ruta", con lo que necesitamos pasar el path parameter adecuado para que la función lo lea correctamente. Esto nos va a hacer cambiar ligeramente la función `viaHandler` que te debería quedar así:
```
async function viaHandler(functionPath, event) {
  // eslint-disable-next-line import/no-dynamic-require
  const handler = require(`../../src/functions/${functionPath}`);

  // because of https://github.com/middyjs/middy/issues/198
  return new Promise(async (resolve, reject) => {
    const context = {};
    const callback = (something, response) => {
      response.body = JSON.parse(response.body);
      resolve(response);
    };
    await handler.handler(event, context, callback);
  });
}
```

En lugar de crear un evento vacío dentro de la promesa, lo pasamos por parámetro.

Otra cosa que habrás notado en el test, es que ahora utilizamos un modulo llamado `given`, así que necesitamos crearlo. Crea un archivo llamado `given.js` en la carpeta `tests/steps` con el siguiente contenido:

```
const AWS = require("aws-sdk");
const chance = require("chance").Chance();
require("dotenv").config();

const randomPassword = () =>
  // needs number, special char, upper and lower case
  `${chance.string({ length: 8 })}Un1vers1t1!`;

module.exports.an_authenticated_user = async () => {
  AWS.config.region = process.env.AWS_REGION;
  const cognito = new AWS.CognitoIdentityServiceProvider();

  const userpoolId = process.env.cognitoUserPoolId;
  const clientId = process.env.cognitoServerClientId;

  const firstName = chance.first();
  const lastName = chance.last();
  const username = `test-${firstName}-${lastName}-${chance.string({
    length: 8
  })}`;
  const password = randomPassword();
  const email = `${firstName}-${lastName}@pufouniversity.com`;

  const createReq = {
    UserPoolId: userpoolId,
    Username: email,
    MessageAction: "SUPPRESS",
    TemporaryPassword: password,
    UserAttributes: [
      { Name: "given_name", Value: firstName },
      { Name: "family_name", Value: lastName },
      { Name: "email", Value: email }
    ]
  };

  await cognito.adminCreateUser(createReq).promise();

  console.log(`[${username}] - user is created`);

  const req = {
    AuthFlow: "ADMIN_NO_SRP_AUTH",
    UserPoolId: userpoolId,
    ClientId: clientId,
    AuthParameters: { USERNAME: email, PASSWORD: password }
  };

  const resp = await cognito.adminInitiateAuth(req).promise();

  console.log(`[${email}] - initialised auth flow`);

  const challengeReq = {
    UserPoolId: userpoolId,
    ClientId: clientId,
    ChallengeName: resp.ChallengeName,
    Session: resp.Session,
    ChallengeResponses: { USERNAME: email, NEW_PASSWORD: randomPassword() }
  };

  const challengeResp = await cognito
    .adminRespondToAuthChallenge(challengeReq)
    .promise();

  console.log(`[${username}] - responded to auth challenge`);
  return {
    email,
    firstName,
    lastName,
    idToken: challengeResp.AuthenticationResult.IdToken
  };
};
```

Lo que estamos haciendo aquí es, básicamente, crear un nuevo usuario y autenticarnos con él utilizando cognito. Si ahora intentamos correr los tests de integración, nos van a fallar porque no tenemos creadas las variables de entorno que utilizamos en este archivo para autenticarnos. Y no las tenemos porque todavía no hemos desplegado cognito en nuestro proyecto. Antes de hacerlo, vamos a hacer un poco de limpieza en nuestro archivo `serverless.yml`. Crea una carpeta llamada `resources` y crea un archivo dentro de ella llamado `masters-dynamodb-table-yml`. Dentro del archivo, tendrias que poner la definición de la tabla que tienes en el archivo `serverless.yml`, es decir, esto:
```
Resources:
  MastersTable:
    Type: AWS::DynamoDB::Table
    Properties:
      TableName: ${self:custom.mastersTable}
      AttributeDefinitions:
        - AttributeName: id
          AttributeType: N
      KeySchema:
        - AttributeName: id
          KeyType: HASH
      BillingMode: PAY_PER_REQUEST

  EnrollMasterEventsStream:
    Type: AWS::Kinesis::Stream
    Properties: 
      Name: ${self:custom.enrollMasterEventsStream}
      ShardCount: 1
```

Y en el archivo `serverless.yml` reemplazar la definición de la tabla, por la carga de este archivo:
```
resources:
  - ${file(resources/masters-dynamodb-table.yml)}
```

Ahora que ya tenmeos esto un poco más ordenado, vamos a crear la user pool de cognito. Crea un nuevo fichero en la carpeta `resources` llamado `cognito-user-pool.yml` con el siguiente contendio:
```
Resources:
  CognitoUserPool:
    Type: AWS::Cognito::UserPool
    Properties:
      # Generate a name based on the stage
      UserPoolName: ${self:custom.stage}-user-pool
      # Set email as an alias
      UsernameAttributes:
        - email
      AutoVerifiedAttributes:
        - email

  CognitoUserPoolClient:
    Type: AWS::Cognito::UserPoolClient
    Properties:
      # Generate an app client name based on the stage
      ClientName: ${self:custom.stage}-user-pool-client
      UserPoolId:
        Ref: CognitoUserPool
      ExplicitAuthFlows:
        - ADMIN_NO_SRP_AUTH
      GenerateSecret: false

# Print out the Id of the User Pool that is created
Outputs:
  UserPoolId:
    Value:
      Ref: CognitoUserPool

  UserPoolClientId:
    Value:
      Ref: CognitoUserPoolClient

```

Ya lo tenemos. Es hora de deployar porque vamos a necesitar esos ids que antes hablábamos y no los vamos a tener hasta que no deployemos:
```
SLSUSER=manolete npm run deploy
```

Ahora toca recuperar los ids, y para ello tendremos que ir a la consola. Ve al servicio cognito y selecciona el user pool recién creada. En esa página verás el id, cópiatelo. En esta misma página, en la sección App integration -> App client settings podrás recuperar el cognito server client id. 

Ya estamos un poco más cerca de poder lanzar los tests, nos falta poder setear estos valores como variables de entorno. Para hacerlo, utilizaremos un fichero .env. Hay que tener en cuenta que no queremos subir este fichero al repositorio, así que edita el fichero `.gitignore` y añade el fichero `.env`. Para cargar este fichero utilizaremos una libreria llamada dotnev. Ve a tu terminal y añádela al proyecto como dev dependency.
```
npm install dotenv --save-dev
```

Crea un fichero llamado `.env` en la raiz de tu proyecto y añade los ids que acabamos de recuperar. Tu fichero debería tener esta pinta:
```
cognitoUserPoolId=eu-west-1_XXXXXXXX
cognitoServerClientId=XXXXXXXXXXXXXXXXXXXXX
```

Ahora ya puedes correr los tests de integración y te deberían pasar.

Toca ponernos con los tests de aceptación. Si los intentamos pasar ahora, veremos que nos falla porque no puede crear el usario para el test. Nos toca hacer un pequeño cambio a la manera que llamámos a los test de aceptación:
```
TEST_BASE_URL='https://xxxxx.execute-api.eu-west-1.amazonaws.com/devmanolete/api' AWS_PROFILE=serverless-local npm run test:acceptance
```

Ahora el test nos fallará pq el endpoint no está publicado. Vamos a añadirlo a nuestro `serverless.yml`:
```
getMasterDetails:
  handler: src/functions/getMaster.handler
  events:
    - http:
        path: api/master/{id}
        method: get
  environment:
    mastersTable: ${self:custom.mastersTable}
  iamRoleStatements:
    - Effect: Allow
      Action: dynamodb:query
      Resource: arn:aws:dynamodb:#{AWS::Region}:#{AWS::AccountId}:table/${self:custom.mastersTable}
    - Effect: Allow
      Action: ssm:GetParameters*
      Resource: arn:aws:ssm:#{AWS::Region}:#{AWS::AccountId}:parameter/pufouniversity/*
```

Y deployamos
```
SLSUSER=manolete npm run deploy
```

Volvemos a pasar los tests de aceptación:
```
TEST_BASE_URL='https://xxxxxxxx.execute-api.eu-west-1.amazonaws.com/devmanolete/api' AWS_PROFILE=serverless-local npm run test:acceptance
```

y vemos que el test está en verde! Genial, no? Bueno, no del todo. Resulta que hemos deployado el endpoint sin autenticación, así que estamos haciendo un poco de trampa. Vamos a añadir-le autenticación. Edita el fichero `serverless.yml` y, en la función de `getMasterDetails` añade el authorizer en la definición del evento:
```
events:
  - http:
      path: api/master/{id}
      method: get
      authorizer:
        arn: arn:aws:cognito-idp:#{AWS::Region}:#{AWS::AccountId}:userpool/${self:custom.vars.userPoolId}
```

Sólo nos queda cargar correctamente la variable userPoolId. Crea un archivo llamado `vars.yml` en la raiz de tu proyecto con este contenido:
```
dev-user:
  userPoolId: "eu-west-1_VTdZAauUw"
sit:
  userPoolId: ""
prod:
  userPoolId: ""
```

De momento nos vamos a centrar en nuestro entorno local y ya haremos pasar la build completa al final. Ahora edita la sección custom del fichero `serverless.yml` y añádele estas dos líneas:
```
defaultVarsStage: dev-user
vars: ${file(./vars.yml):${opt:stage, self:custom.defaultVarsStage}}
```

Básicamente, estamos cargando el fichero y después estamos definiendo una variable que cojerá el valor de la variable de entorno y, en caso de no existir, lo cojerá del fichero.

Ya podemos deployar otra vez, e intentar pasar los tests de aceptación. En este caso, el nuevo test no nos pasará, ya que el endpoint nos devolverá un 401. Esto es porque, en el test, no estamos pasando el usuario correctamente. Si te fijas en el fichero `when.js`, verás que, cuando llamámos a la función via http, estamos pasando el idToken, pero no estamos haciendo nada con él. Modifica la función `viaHttp` para que tenga este aspecto:
```
async function viaHttp(functionPath, method, idToken) {
  const apiRoot = process.env.TEST_BASE_URL;

  const url = `${apiRoot}/${functionPath}`;

  try {
    const httpReq = http(method, url);
    if (idToken) {
      httpReq.set("Authorization", idToken);
    }

    const res = await httpReq;

    return {
      statusCode: res.status,
      body: res.body
    };
  } catch (err) {
    if (err.status) {
      return {
        statusCode: err.status
      };
    }
    throw err;
  }
}
```

Como ves, estamos añadiendo la cabezera de autorización. Vuelve a pasar los tests... y tachán!! Tests en verde! Es hora de hacer un push y mirar como va nuestra build.

La build falla pq el arn que estamos pasando como authorizer no es correcto. Y no es correcto pq la variable userPoolId no está seteada. Aqui tenemos una pequeña "referencia circular", ya que no podremos setearla hasta que no deployemos, y no podemos deployar pq no está setada. Vamos a hacer un poco de trampa (solo un poco) y vamos a copiar el valor de la variable en dev-user a sit en el fichero `vars.yml`. Hacemos commit y push y miramos como va la build. En este caso fallará porque, si te acuerdas, en los tests de integración estamos utilizando un par de variables de entorno que no estamos seteando (`cognitoUserPoolId` y `cognitoServerClientId`). Vamos a CircleCI y seteamos estas variables de entorno con los valores del entorno sit y volvemos a correr la build. 

Esta vez la build tendría que llegar hasta el deployment a producción, que fallará por la misma razón que antes. Así que hacemos lo mismo, actualizamos en el fichero `vars.yml` la variable userPoolId del entorno de producción con el valor del entorno de sit, comiteamos y pusheamos, esto hará que se cree la user pool de producción y volvemos a actualizar el contenido de nuestro fichero `vars.yml`. Volvemos a comitear y pushear y debería estar toda la pipeline en verde.

Nos vamos acercando al final!! El próximo paso será añadir una sencilla UI a nuestro proyecto.
