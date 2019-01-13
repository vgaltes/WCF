# NO ME PUEDO CREER QUE PUEDA HACER UNA APLICACIÓN SERVERLESS EN DOS HORAS

Hola, bienvenido a este workshop sobre Serverless. Antes de empezar necesitaria que configuraras unas cuantas cosas en tu ordenador. Debes hacer esto antes de venir al workshop por dos razones:
 - No perder el tiempo en los preparativos durante el workshop y así sacar el máximo provecho de él.
 - Algunas cuentas pueden tardar unas horas en activarse. Si lo haces al principio del workshop puede ser que no tengas la cuenta activa durante el mismo.

## Pre-requisitos

### Cuenta en AWS
Vamos a utilizar AWS Lambda, así que necesitas tener una cuenta en AWS. No te preocupes, puedes crear una cuenta gratuita sin problemas [aquí](https://aws.amazon.com/free/start-your-free-trial/).

Vamos a necesitar un par de usuarios en tu cuenta para el workshop. Uno será el que utilizaremos en local para desplegar y probar la aplicación. El segundo será el que utilizará nuestro sistema de integración contínua para desplegar y probar la aplicación. Vamos a por ello: repite los siguientes pasos dos veces (una por usuario) con diferentes nombres de usuario.
 - Haz login en tu cuenta de AWS y ve a la página Identity & Access Management (IAM)
 - Haz click en Users y después en Add User. Introduce serverless-local como nombre para el primer usuario y serverless-agent como nombre para el segundo usuario. Activa Programmatic Access. Haz click en Next para ir a la página de permisos. Haz click en Add user to group y selecciona el grupo Administrators.
 - Clica en Next: tags. 
 - Clica en Next: review. Chequea que todo está bien y clica en Create user. 
 - Visualiza y copia la API Key y el Secret a un lugar temporal. Lo necesitaremos más tarde.

Esto no es una buena práctica. La buena práctica sería dar los mínimos permisos posibles a este usuario (y a todos). Para hacerlo, crearíamos una policy en la que especificaríamos los mínimos permisos (algo como lo que puedes encontrar [aqui](https://gist.githubusercontent.com/ServerlessBot/7618156b8671840a539f405dea2704c8/raw/bfc213d5b20ad0192217d5035ff526792535bdab/IAMCredentials.json)) y asiganaríamos esa policy al usurio. Cada vez que viéramos que nos falta un permiso, deberíamos cambiar la policy. Para no tener que ir haciendo esto cada dos por tres, asignamos el usuario al grupo Administrators, pero no debéis hacer esto en un proyecto en producción. Hay herramientas que nos pueden ayudar como [esta](https://www.trek10.com/blog/excess-access-exorcism-with-aws-config/) o [esta](https://github.com/dancrumb/generator-serverless-policy).

### Creación de un profile en nuestro ordenador.
Ahora es la hora de configurar nuestro ordenador para que utilice estas credenciales a la hora de desplegar nuestra aplicación. Hay varias maneras de hacer esto pero la mejor es utilizar un profile y que este no sea el profile por defecto, para evitar posibles desgracias en el futuro.

Para setear este profile hay varias maneras, pero la más cómoda es utilizar el propio [Serverless framework](https://serverless.com). Así que clona o "forkea" este repositorio e instala los paquetes npm utilizando el comando `npm install`. Una vez instalados, ejecuta el siguiente comando: `./node_modules/.bin/serverless config credentials --provider aws --key <tu_key> --secret <tu_secret> --profile serverless-local`

Dónde `tu_key` y `tu_secret` son los datos que nos hemos guardado del paso anterior para el usuario serverless-local. Las claves para el usuario serverless-agent las utilizaremos más tarde, así que guárdalas bien. Con esto ya tendremos el profile creado.

### Cómo deployar
Para deployar vamos a utilizar el framework Serverless. Este framework nos abstrae de mucha complejidad a la hora de desplegar aplicaciones serverless. Como habrás observado, hemos instalado el framework como una dependencia local en nuestro proyecto. Esto es una buena práctica, ya que así evitamos problemas de incompatibilidad de versiones entre diferentes desarrolladores y también evitamos tener que tener instalado el framework en nuestra agente de build.

El framework basa su funcionamiento en un fichero llamado serverless.yml que tiene que existir en la raiz de nuestro proyecto. Vamos a ver que hay en este fichero de mínimos que tenemos por ahora:
```
service: pufouniversity
```

Esto es el nombre del servicio. Dentro de un servicio podemos tener diferentes Lambdas y otros recursos. Todos estos recursos se tratan como un todo. Por ejemplo, si le digo al framework que elimine el servicio, eliminará todos los recursos que existan en este fichero. Esto en AWS se traduce a un stack de CloudFormation. 

A parte, el framework utilizará este nombre como prefijo a todos los recursos, de manera que serán fáciles de buscar en nuestra subscripción.

```
custom:
  defaultRegion: eu-west-1
  stage: ${opt:stage, self:provider.stage}
```

Aquí definiremos algunas variables propias que después podremos utilizar en el fichero. Aquí estamos definiendo una variable llamada `defaultRegion` que tiene el valor `eu-west-1` y, lo que es más interesante, una variable llamada `stage` que toma su valor por interpolación. Lo que hace esta interpolación es intentar coger el valor de `opt:stage`. `opt:stage` es el valor del parámetro stage cuando llamamos a `serverless deploy` por línea de comandos: `serverless deploy --stage sit`. En el caso que no le pasemos este parámetro al hacer deploy, la interpolación nos dice que cogerá el valor del campo stage de la sección provider (que ahora veremos).

```
provider:
  name: aws
  runtime: nodejs8.10
  region: ${opt:region, self:custom.defaultRegion}
  stage: dev${env:SLSUSER, ""}
```

En esta sección definiremos cual es nuestro provider (AWS. Azure, Google Cloud, etc). En nuestro caso le decimos que es `aws` y que el runtime que vamos a utilizar es `nodejs8.10`. Para la region utilizamos una interpolación como la que hemos visto antes. Para el stage, utilzamos una interpolación un poco distinta. En este caso le decimos que el nombre del stage (en la sección provider) siempre empezará por dev y después pueden pasar dos cosas: si la variable de entorno SLSUSER está seteada, utilizaremos su valor, sinó no utilizaremos nada. Es decir, si yo tengo `manolete` como valor de la variable de entorno SLSUER, el valor de stage será `devmanolete`. Si no la tengo seteada el valor de stage será `dev`. Esto lo hacemos para que cada usuario pueda tener su propio entorno de pruebas de una manera sencilla.

```
functions:
  initialTest:
    handler: src/functions/initialTest.handler
    events:
      - http:
          path: api/initialTest/{name}
          method: get
```

Finalmente tenemos la sección de las funciones. En este caso estamos definiendo una función llamada `initialTest`, cuyo código está en `src/functions/initialTest.js` y dentro de ese fichero en una función llamada `handler`, que se activa por una llamda http GET al path `api/initialTest` y que tiene un path parameter llamado `name`. Es decir, que nuestra función se podrá llamar haciendo un get a una dirección parecida a `https://XXXXXXXX.execute-api.eu-west-1.amazonaws.com/devmanolete/api/initialTest/wecodefest`. Cuando hayamos desplegado la función y la llamemos, recibiremos como respuesta `Hello wecodefest`.

### Primer deploy
Antes de ver como está escrita la función, vamos a desplegarla para comprobar que lo tenemos todo bien configurado.

Si miras el fichero `package.json`, en la sección de scripts verás que hay un script llamado deploy que ejecuta lo siguiente:
```
serverless deploy --aws-profile serverless-local
```

Este comando lo que hace es decirle al framework que deploye el servicio utilizando el profile `serverless-local` que es el que acabamos de configurar. Si ejecutamos este comando tal cual, nos va a deployar el servicio en el stage dev. Pero nosotros queremos que lo haga en el nuestro propio. Para eso tenemos dos opciones:
 - Setear la variable de entorno en nuestra máquina y ejecutar el comando: `npm run deploy`.
 - Setear la variable de entorno solo para la ejecución del comando: `SLSUSER=manolete npm run deploy`.

Puedes utilizar la que te haga más (o menos) rabia.

Venga, dale a ver qué pasa!! Si todo va bien, verás un montón de lineas de log del framework y al final nos mostrará un resumen de la información del servicio. En ella, en la sección de endpoints podremos ver la dirección final de nuestro endpoint. Cópiala, cambia {name} por WeCodeFest y ejecuta la petición utilizando el navegador, postman, curl o lo que quieras.

Algo interesante a observar también es el nombre del stack, que es la concatenación del nombre del servicio con el nombre del stage, y el nombre de la función, que es lo mismo pero con el nombre de la función al final.

Si tienes todo esto funcionando estás donde tienes que estar para empezar el workshop. Si no lo tienes, antes del día del workshop, envíame un correo o contáctame por twitter para arreglarlo.

## Paso 1 - Recuperando la lista de masters

Vamos a empezar implementando el endpoint que nos devuelve la lista de masters. Pero como queremos hacer esto un poco bien, vamos a empezar escribiendo los tests. 

Cuando estamos desarrollando una aplicación serverless, es muy posible que la típica pirámide de tests no nos sea tan útil. Sí que vamos a necesitar tests unitarios la mayoría de las veces, pero la parte más crítica en el testing vendrá de la mano de los tests de integración y de aceptación. En una aplicación serverless por defecto vamos a interactuar con otros recursos (otras lambdas, una base de datos, sistemas de mensajería, etc) con lo que la parte crítica a testear van a ser estas interacciones. A parte, podremos ver que muchas veces nuestros tests de interacción y de aceptación son muy parecidos (por no decir iguales) y simplemente cambia cómo llamo a la función llamándola directamente o haciendo una petición HTTP. Esta va a ser la aproximación que vamos a seguir aquí. Vamos a tener el mismo test de aceptación que de integración y sólo vamos a cambiar la manera de llamar a la función. Empecemos pues!

Vamos a crear nuestro primer test. Crea un fichero en la carpeta `tests` llamado `getMasters.spec.js` con el siguiente contenido:
```
const when = require("./steps/when");

describe(`When we invoke the GET /masters endpoint`, () => {
  test(`Should return an array of 8 masters`, async () => {
    const res = await when.we_invoke_get_masters();

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveLength(8);

    for (let i = 0; i < res.body.length; i += 1) {
      const master = res.body[i];
      expect(master).toHaveProperty("id");
      expect(master).toHaveProperty("name");
      expect(master).toHaveProperty("description");
    }
  });
});
```

Crea otro fichero en la carpeta `tests/steps` llamado `when.js` con el siguiente contenido:
```
const http = require("superagent-promise")(require("superagent"), Promise);

const mode = process.env.TEST_MODE;

async function viaHttp(functionPath, method) {
  const apiRoot = process.env.TEST_BASE_URL;

  const url = `${apiRoot}/${functionPath}`;

  try {
    const res = await http(method, url);

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

async function viaHandler(functionPath) {
  // eslint-disable-next-line global-require
  const handler = require(`../../src/functions/${functionPath}`);
  const response = await handler.handler();
  response.body = JSON.parse(response.body);
  return response;
}

module.exports.we_invoke_get_masters = () =>
mode === "http" ? viaHttp("masters", "GET") : viaHandler("getMasters");
```

Y, finalmente, añade los paquetes `superagent` y `superagent-promise` al proyecto:
```
npm install --save-dev superagent
npm install --save-dev superagent-promise
```

Y ahora si compilas, no deberías tenner ningún error. Es broma, esto es JS, por ahora nos tendremos que fiar de ESLint.

El test es bastante fácil de entender: llamamos a la función y nos tiene que devolver una lista de masters. La "chicha" está en el fichero `when.js`. Lo que se hace en este fichero es que, depende del valor de la variable de entorno llamada `TEST_MODE` llamamos a la función utilizando un cliente HTTP (superagent) o invocamos al handler directamente. En caso de llamarla via HTTP, necesitamos otra variable de entorno que nos dirá la dirección URL base, que puede sacar del deploy que hemos hecho antes. Obviamente esta url va a cambiar dependiendo del stage al que deployes. Vamos a intentar llamar al test en modo HTTP:
```
TEST_MODE=http TEST_BASE_URL='https://XXXXXXXXXX.execute-api.eu-west-1.amazonaws.com/devmanolete/api' ./node_modules/.bin/jest ./tests/*
```

Veremos que el resultado es un test fallido, porqué el endpoint no está. 

Podemos intentar lo mismo con el test de integración:
```
TEST_MODE=handler ./node_modules/.bin/jest ./tests/*
```

Obtendremos también un test fallido, ya que el endpoint no está.

Ahora que sabemos qué comandos tenemos que ejecutar para los tests, incorporémoslos a la sección de scripts del package.json:

```
"test:acceptance": "TEST_MODE=http TEST_BASE_URL='https://XXXXXXXXX.execute-api.eu-west-1.amazonaws.com/devmanolete/api' jest ./tests/*",
"test:integration": "TEST_MODE=handler jest ./tests/*",
```

Para este ejercicio, con esto nos bastaría. En un proyecto con más gente, podríamos crear un script para cada entorno que el equipo tenga (dev, sit, pre) con la url correcta, y dejar el script del test de aceptación del usuario sin URL y que la tengamos que especificar a mano. Por ahora nosotros lo vamos a dejar así.

Ahora podemos correr los tests de aceptación y de integración de la siguiente manera:
```
npm run test:acceptance
npm run test:integration
```

Pues vamos a intentar que el resultado de estos tests sea un poco mejor. Vamos a crear la función!

Por ahora, cambia el nombre del fichero que ya tenemos llamado `initialTest.js` y llámalo `getMasters.js`. En el fichero `serverless.yml`, cambia la definición de la función. Tendrías que tener esto:

```
functions:
  getMasters:
    handler: src/functions/getMasters.handler
    events:
      - http:
          path: api/masters
          method: get
```

Lo primero que vamos a intentar es tener el test de integración en verde. Anteriormente el test se quejaba que no podía encontrar el fichero. Ahora lo debería poder encontrar pero fallar porqué el resultado no es el esperado. Vamos a comprobarlo. Ejecuta los test de integración:
```
npm run test:integration
```

Efectivamente, el error es diferente. Vamos mejorando. Lo que vamos a querer, es recuperar los masters de una base de datos. Para ello vamos autilizar DynamoDB con la nueva característica que tiene de pago por uso. Y para definirla, vamos a incorporar una nueva sección al fichero `serverless.yml` que es la de los recursos. El framework nos permite definir recursos de CloudFormation directamente en el fichero, de manera que serán deployados cuando deployemos el servicio entero. Vamos a definir nuestra tabla de DynamoDb. Añade esto al final del fichero `serverless.yml`:

```
resources:
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
```

Con esto definimos una tabla en DynamoDB con una clave numérica llamada id. Como ves, el nombre de la tabla viene definido en una propiedad custom, que tenemos que añadir a la sección custom:

```
mastersTable: masters-${self:custom.stage}
```

Si ahora deployamos:
```
SLSUSER=manolete npm run deploy
```

y nos vamos al servicio de DyanamoDB, deberíamos ver una tabla llamada `masters-devmanolete`. Genial!

Ahora tenemos que cambiar la función para que acceda a esta tabla. Cambia el contenido del fichero `getMasters.js` por el siguiente:
```
const AWS = require("aws-sdk");

const dynamodb = new AWS.DynamoDB.DocumentClient();
const tableName = process.env.mastersTable;

module.exports.handler = async () => {
  const count = 8;

  const req = {
    TableName: tableName,
    Limit: count
  };

  const resp = await dynamodb.scan(req).promise();

  const res = {
    statusCode: 200,
    body: JSON.stringify(resp.Items)
  };

  return res;
};
```

Básicamente lo que estamos haciendo aquí es recuperar 8 elementos de la tabla en cuestión. Hay dos cosas importantes a hacer. La primera es que debemos instalar el paquete aws-sdk en nuestro proyecto:
```
npm install --save aws-sdk
```

La segunda es que, si te fijas, el nombre de la tabla lo estamos pasando por una variable de entorno. Por lo tanto necesitamos pasar este valor tanto en la función, como en el test. Vamos a empezar por el test, dado que por ahora estamos intentando hacer pasar el test de integración.

En el directorio `tests/steps` crea un archivo llamado `init.js` con el siguiente contenido:
```
module.exports.init = () => {
  process.env.mastersTable = "masters-devmanolete";
  process.env.AWS_REGION = "eu-west-1";
};
```

Aquí aplica lo mismo que antes. Podemos quitar la línea donde seteamos la variable `mastersTable` y dejar que cada usuario la setee al llamar a los tests. Por ahora nos vale esto a nosotros.

Ahora tenemos que cambiar un poco nuestro test. Añade este require:
```
const { init } = require("./steps/init");
```

Y este beforeAll justo antes del test:
```
beforeAll(() => {
    init();
});
```

Y vuelve a lanzar el test de integración:
```
npm run test:integration
```

Verás que ahora nos da un error de conexión. Esto es porque el usario con el que corremos los tests no tiene permisos para acceder a la base de datos. Esto pasa porque estamos utilizando un profile de AWS que no es el de por defecto, así que necesitamos especificar el profile correcto a la hora de correr el test. Prueba con el siguient comando:

```
AWS_PROFILE=serverless-local npm run test:integration
```

Hey! El error ahora ya tiene mucha mejor pinta. En lugar de recibir 8 items, estamos recibiendo un array vacío. Eso quiere decir que necesitamos llenar de datos nuestra base de datos. 

Crea un fichero en la raiz del proyecto llamado `seedMasters.js` con el siguiente contenido:
```
const AWS = require("aws-sdk");

const tableName = process.argv.slice(2)[0];

AWS.config.region = "eu-west-1";
const dynamodb = new AWS.DynamoDB.DocumentClient();

const masters = [
  {
    id: 1,
    name:
      "Master universitario en Análisis de las Relaciones Económicas Internacionales",
    description:
      "El alumno profundiza en los conocimientos aplicados de las economías internacionales lo cual es de un elevado valor académico dado la amplia interconexión de todas las economías en un mundo cada vez más globalizado. Además el alumno adquiere no solo herramientas económicas sino también jurídicas para aplicar al marco de las relaciones bilaterales y multilaterales que se establecen entre los distintos países."
  },
  {
    id: 2,
    name: "Master universitario en Asesoría Jurídico-Laboral",
    description:
      "El Máster Universitario que se presenta brinda una formación especializada en los aspectos jurídicos de las relaciones laborales. Está enfocado hacia la adquisición de un conocimiento avanzado de las relaciones de trabajo y de Seguridad Social desde el punto de vista normativo, así como de los conflictos individuales y colectivos que de ellas se derivan y de su tratamiento jurisprudencial. El objetivo es formar profesionales capaces de asesorar legalmente a las empresas, los trabajadores y los beneficiarios de la Seguridad Social, tanto en el día a día como en las situaciones litigiosas a las que se enfrenten. Ofrece una completa educación de postgrado a quienes pretenden desarrollar su actividad profesional en el área del asesoramiento laboral en su vertiente jurídico-empresarial, sustantiva y de procedimiento."
  },
  {
    id: 3,
    name: "Master universitario en Responsabilidad Civil Extracontractual",
    description:
      "Debido al escaso desarrollo legislativo de la institución de la responsabilidad civil, cobra especial importancia la metodología docente enfocada a la resolución de supuestos prácticos que han tenido eco en nuestra jurisprudencia, en la de países de nuestro entorno, o en la jurisprudencia comunitaria. La modalidad presencial, unida al trabajo del alumno mediante la resolución de casos prácticos propuestos por el profesor, se adapta perfectamente al aspecto práctico de la enseñanza, diseñándose la didáctica a partir del “casus”, sin desdeñar una sólida base teórica de los contenidos."
  },
  {
    id: 4,
    name: "Master universitario en Comunicación y Problemas Socioculturales",
    description:
      "Se plantea la profundización e investigación sobre prácticas comunicativas y su incidencia en la sociedad en su conjunto y, en especial, en los sectores más vulnerables, como los inmigrantes, los menores, los colectivos de mujeres o los movimientos sociales. Preparar profesionalmente a los alumnos para afrontar la cambiante realidad social con conocimientos y destrezas adecuados y especializados en este ámbito."
  },
  {
    id: 5,
    name: "Master universitario en Derecho Penal Económico",
    description:
      "El Máster que se propone ofrece una formación especializada y multidisciplinar, indispensable para aquellos juristas que orienten su actividad profesional en el campo del Derecho penal económico y el Derecho penal de la empresa, dotándoles, así mismo, de los instrumentos y competencias necesarias para la práctica jurídica en esta rama del Derecho. Sin perjuicio, de ofrecer un conocimiento teórico suficiente a aquellos futuros investigadores que pretendan desarrollar su trabajo científico en esta materia."
  },
  {
    id: 6,
    name: "Master universitario en Emprendedores",
    description:
      "El objetivo fundamental del programa consiste en la promoción de la investigación científica del estudiante en la problemática asociada al impulso emprendedor y el análisis exhaustivo de los factores críticos de éxito y de fracaso que provienen de las experiencias emprendedoras. El análisis en profundidad del papel de las instituciones en la promoción de creación de empresas y la búsqueda y propuesta de políticas que permitan mejorar las condiciones para la creación y mantenimiento de empresas en la economía de mercado desde diferentes perspectivas, empresariales, legales, económicas, institucionales, etc."
  },
  {
    id: 7,
    name: "Master universitario en Economía de la Escuela Austríaca",
    description:
      "El Máster Universitario en Economía de la Escuela Austriaca tiene como objetivo proporcionar a los alumnos las herramientas y métodos propios de la Escuela Austriaca de Economía, así como los conocimientos para la aplicación de los mismos al análisis de los problemas económicos. A lo largo de varios meses de formación, el alumno alcanzará un alto grado de conocimiento en el ámbito de los procesos de mercado, la economía monetaria, los ciclos económicos, el estudio evolutivo de las instituciones, el análisis del intervencionismo,  y los procesos de innovación tecnológica."
  },
  {
    id: 8,
    name: "Master universitario en Periodismo Internacional ",
    description:
      "El Máster en Periodismo Internacional tiene por objeto satisfacer la demanda de nuevos profesionales expertos en Periodismo Internacional, capacitados para integrarse en un entorno profesional de creación de contenidos en el ámbito de las relaciones internacionales multimedia y digitales."
  }
];

const putReqs = masters.map(x => ({
  PutRequest: {
    Item: x
  }
}));

const req = {
  RequestItems: {
    [tableName]: putReqs
  }
};

dynamodb
  .batchWrite(req)
  .promise()
  .then(() => console.log("all done"));
```

Y crea un nuevo script en el fichero `package.json`:
```
"seedMasters": "node seedMasters.js masters-devmanolete",
```

Ejecuta el script:
```
AWS_PROFILE=serverless-local npm run seedMasters
```

Y vuelve a ejecutar los test de integración:
```
AWS_PROFILE=serverless-local npm run test:integration
```

Tachán!! El test está en verde! Vamos a ver qué tal está el de aceptación. Deploya primero:
```
SLSUSER=manolete npm run deploy
```

y ejecuta los test de aceptación:

```
npm run test:acceptance
```

Nos da un error 502, que quiere decir que algo chungo ha pasado al ejecutar la función. Parece que no, pero es un paso adelante. Tendremos que echar un ojo a los logs para saber qué ha pasado. Si utilizamos Javascript, todo lo que escribimos a console.log va a un log stream de CloudWatch. Ve a la lambda en la consola de AWS, selecciona la pestaña Monitoring y clica en el botón View logs in CloudWatch. Se te abrirá una ventana nueva con los streams de logs de esa lambda. Selecciona el último y mira el mensaje. Verás que dice que la variable tableName no está seteada. Esto es porque no le hemos dicho a la función que queremos pasarle esa variable. Esta es la gracia de tener tests de aceptación, que pillamos este tipo de errores. Edita el fichero `serverless.yml` y añade lo siguiente a la función, justo después de events, a su misma altura (recuerda, esto es un yml y te fallará si la indentación no es correcta): 
```
environment:
  mastersTable: ${self:custom.mastersTable}
```

Vuelve a deployar y a correr los tests:
```
SLSUSER=manolete npm run deploy
npm run test:acceptance
```

El test nos sigue fallando. Vuelve a mirar los logs (vigila que estarán en un nuevo stream), y verás que ahora el error es de permisos. El usuario que está corriendo la lambda, no tiene permisos para acceder a la base de datos. Arreglemos esto.

Lo primero que necesitaremos es instalar un par de plugins del framework Serverless. El framework permite su extensión a base de plugins, que son muy fáciles de programar (en JS) y que nos permiten hacer tareas no contempladas en el framework base. 

```
npm install --save-dev serverless-pseudo-parameters
npm install --save-dev serverless-iam-roles-per-function
```

Ahora los tenemos que referenciar en el fichero `serverless.yml`. Incluye esto justo después de la línea del `service`Ñ
```
plugins:
  - serverless-pseudo-parameters
  - serverless-iam-roles-per-function
```

Y por último, le vamos a decir a nuestra función que queremos que tenga permisos para hacer un scan de la tabla de DynamoDB. Añade esto a la función, al mismo nivel que events y environment.
```
iamRoleStatements:
  - Effect: Allow
    Action: dynamodb:scan
    Resource: arn:aws:dynamodb:#{AWS::Region}:#{AWS::AccountId}:table/${self:custom.mastersTable}
```

Como ves, estamos dicíendole a la función que queremos que tenga el permiso de scan sobre la tabla que hemos creado. Para montar el arn de la tabla, utilizamos las capacidades que nos da el plugin de pseudo-parameters.

Deploya y corre los tests de aceptación:

```
SLSUSER=manolete npm run deploy
npm run test:acceptance
```

Voilà! Test en verde. Buen momento para hacer un push y cerrar este capítulo.

## Paso 2 - Integración contínua

Ahora que ya tenemos una pequeña funcionalidad es hora de ir creando una sencilla pipeline de integración continua, para desplegar nuestro proyecto en producción. Va a ser algo muy sencillo pero que te servirá de guía para tu proyecto. Lo que va a hacer nuestra pipeline es:
 - Descargarse el proyecto
 - Instalar las dependencias
 - Deployar a un entorno que llamaremos sit
 - Recrear la base de datos de ese entorno
 - Correr los tests de integración
 - Correr los tests de aceptación
 - Deployar a prod

Todo esto lo vamos a hacer utilizando un SAAS llamado CircleCI. Así que ya puedes ir a su [web](https://circleci.com) y crearte una cuenta con tu usario de GitHub.

Ahora clica en `Add Projects` y selecciona el repositorio donde estás comiteando todo lo que vamos haciendo. Clica en `Set Up Project`. Selecciona Linux como sistema operativo y node como lenguaje. Clica en `Start Building`. Como bien explica en la web, esto no hará nada porque no hemos definido la build en ningún punto. Antes de hacerlo, selecciona en el icono de `Settings` de tu nuevo proyecto. En el menú de la izquierda, en la sección `Build settings` clica en `Environment Variables`. Tienes que crear dos variables llamadas `AWS_ACCESS_KEY_ID` y `AWS_SECRET_ACCESS_KEY` cuyo valor será la access key y el secret del usuario `serverless-agent` que creamos al principio. De esta manera le estamos diciendo a CircleCI con que usuario de AWS tiene que deployar.

El siguiente paso es crear la definición de la build. Crea un nuevo fichero llamado `config.yml` (sí, otra vez un yaml) dentro de un directorio llamado `.circleci` con el siguiente contenido:
```
version: 2
jobs:
  build:
    docker:
      - image: circleci/node:8.10
    working_directory: ~/repo
    steps:
      - checkout
      # Download and cache dependencies
      - restore_cache:
          keys:
            - v1-dependencies-{{ checksum "package.json" }}
            # fallback to using the latest cache if no exact match is found
            - v1-dependencies-
      - run:
          name: Install dependencies
          command: npm install
      - save_cache:
          paths:
            - node_modules
          key: v1-dependencies-{{ checksum "package.json" }}
      - run:
          name: Deploy application to sit
          command: npm run deploy:sit
      - run:
          name: Recreate database
          command: node seedMasters.js masters-sit
      - run:
          name: Run integration tests
          command: TEST_STAGE=sit npm run test:integration
      - run:
          name: Run acceptance tests
          command: npm run test:acceptance
      - run:
          name: Deploy application
          command: npm run deploy:prod
```

Lo interesante aquí está en los diferentes run. Podrás observar que hay dos cosas que nos van a hacer cambiar un poco lo que tenemos hasta ahora. La primera es que en el paso de los tests de integración, hay una nueva variable de entorno llamada `TEST_STAGE`. Esto lo hacemos porque ahora mismo tenemos hardcodeada el nombre de la tabla a `masters-devmanolete` en el fichero `init.js`. Cuando deployemos a sit no queremos usar esa tabla sino la del entorno para no tener problemas con los permisos. Así que vamos a cambiar un poco el archivo `init.js`:
```
module.exports.init = () => {
  process.env.mastersTable = `masters-${process.env.TEST_STAGE}`;
  process.env.AWS_REGION = "eu-west-1";
};
```

Esto hará que ahora en local los tests de integración no nos pasen tal como los estábamos pasando hasta ahora. Prueba con este comando:
```
AWS_PROFILE=serverless-local TEST_STAGE=devmanolete npm run test:integration
```

Verdes otra vez.

Lo siguiente a fijarse es que nuestro comando para ejecutar los tests de aceptación no ha cambiado, pero si estamos deployando a otro entorno la url base será diferente. Abre el fichero `package.json` y quita el seteo de la variable `TEST_BASE_URL`. Te debería quedar algo así:
```
"test:acceptance": "TEST_MODE=http jest ./tests/*",
```

Ahora deberías llamar al test con algo parecido a esto:
```
TEST_BASE_URL='https://XXXXXXXXX.execute-api.eu-west-1.amazonaws.com/devmanolete/api' npm run test:acceptance
```

También te habrás fijado que estamos llamando a un par de scripts de npm que hasta ahora no teníamos. Edita el `package.json` y añade estos scripts:
```
"deploy:sit": "serverless deploy --stage sit",
"deploy:prod": "serverless deploy --stage prod"
```

Lo que nos quedaría sería setear esa variable en la configuración de CircleCi, pero todavía no sabemos la URL porque no hemos creado el entorno. Así que, guarda todos tus cambios y haz un push para que podamos tener nuestra primera build. Verás que la build ha ido bien hasta los test de aceptación, que era lo que esperábamos. Si clicas sobre el paso de `Deploy application to sit`, al final del log te aparecerá la dirección de la API. Cópiala hasta el último segmento (hasta la palabra api, ésta incluída). Ahora clica en el botón de `Project Settings` (arriba a la derecha) y añade una nueva variable de entorno con nombre `TEST_BASE_URL` y como valor la dirección que acabas de copiar. Vuelve al workflow y clica en `Rerun workflow`.

Build en verde! Hay algo más bonito que eso?


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


## Paso 4 - Monitorización, logging y un poco de seguridad

Va siendo hora de saber qué está pasando en nuestra aplicación, sobretodo cuando falla. Una primera opción es echar un vistazo a una nueva feature de la consola de AWS Lambda, como son las `applications`. Si vais al servicio Lambda, en el menú de la izquierda podréis seleccionar `Applications`. Después seleccionas la tuya y podrás observar unas cuantas dashboards que te pueden ser útiles.

Dónde están los logs?, te preguntaras. En algún paso anterior hemos visto como consultar los logs de una función, pero lo que nos interesaría sería agregar estos logs. Hay varias opciones, como la de reenviar esos logs a otro servicio como ElasticSearch, Logz.io o Splunk. En nuestro caso, vamos a utilizar una herramienta que nos dará más información y nos abstaerá de cierta complejidad como la de manejar los correlation ids. La herramienta que vamos a utilizar se llama Epsagon, de la que ya tendrías que tener la cuenta creada y configurada, y anotado el token que tienes que utilizar. Vamos pues a utilizarla.

Primero de todo, tienes que añadir el paquete al proyecto:
```
npm install --save epsagon
```

Lo siguiente es importar la libería en nuestras funciones. Los pasos que vamos a explicar ahora, los tendrás que hacer en los tres ficheros de funciones. Primero, importa la librería:
```
const epsagon = require("epsagon");
```

después, antes de definir el handler, configura epsagon:
```
epsagon.init({
  token: tuToken,
  appName: process.env.service,
  metadataOnly: false
});
```

Por ahora puedes poner el token aquí directamente, mientras no hagas commit. Después veremos dos formas de guardar este token de una manera más segura. Tendrás que cambiar el archivo `serverless.yml` para añadir la nueva variable de entorno llamda service. Como será una variable que van a utilizar todas las funciones, la podemos poner a nivel de provider. Añade las siguientes línieas en la sección provider:
```
environment:
  service: ${self:service}-${self:custom.stage}
```

De esta manera, podremos diferenciar entre diferentes aplicaciones dentro del dashboard de Epsagon.

Finalmente, rodea tu handler con una llamada a `epsagon.lambdaWrapper()`. Te tendrían que quedar parecido a esto:
```
module.exports.handler = epsagon.lambdaWrapper(async event => {
```

Lo de dentro de lambda wrapper dependerá de la función que estés modificando, pero básicamente será la función tal y como la tenías antes.

Haz esto para las tres funciones, deploya y echa un vistazo al dashboard de Epsagon, donde te tendría que salir un montón de información sobre tu aplicación, la más llamativa de las cuales es la visión de arquitectura.

Como hemos dicho, poner directamente aquí el token, no es demasiado seguro. Veremos un par de maneras de hacer esto más seguro, de menos a más. Para la primera opción, utilizaremos variables de entorno. Cambia las líneas donde hemos configurado Epsagon por las siguientes:
```
epsagon.init({
  token: process.env.epsagonToken,
  appName: process.env.service,
  metadataOnly: false
});
```

Necesitamos crear una nueva variable de entorno, pero lo que no podemos hacer es ponerle el valor directamente en el fichero `serverless.yml`, ya que este fichero va al repositorio de código. Lo que haremos será poner estos valores en un fichero que no vamos a subir al repositorio. Empezamos por asegurarnos que no lo vamos a subir al repositorio. Edita el fichero `.gitignore` y añade la siguiente línea al final:
```
secrets.yml
```

Ahora crea el fichero `secrets.yml` con el siguiente contenido:
```
epsagonToken: tuToken
```
(cambia tuToken por el valor de tu token)

Ahora necesitamos cargar este fichero en nuestro `serverless.yml`. En la sección custom, añade esta línea:
```
secrets: ${file(./secrets.yml)}
```

Ahora solo nos falta utilizar esta nueva variable para setear la variable de entorno. Añade esta línea al `environment` de la sección provider:
```
epsagonToken: ${self:custom.secrets.epsagonToken}
```

Ya tenemos el token como variable de entorno. Si ahora deployas, todo te debería seguir funcionado correctamente.

El gran problema de esta aproximación es que en el servicio de integración contínua no tendremos este fichero. Podriamos utilizar una interpolación como esta:
```
epsagonToken: ${self:custom.secrets.epsagonToken, env:EPSAGON_TOKEN}
```

Y definir la variable de entorno EPSAGON_TOKEN en nuestro agente de build. Pero vamos a intentar utilizar algo más avanzado como es Parameter Store, que es un servicio de Amazon para guardar secrets. Vamos a ver dos maneras de utilizar esto, desde el mismo `serverless.yml` y desde código.

Así que ve a la consola de AWS, selecciona el servicio EC2, y en el menú de la izquierda, selecciona la penúltima opción, `Parameter Store`. Crea dos parámetros para ver los dos modos de trabajo que tenemos. El primero se va a llamar `/pufouniversity/devmanolete/epsagonToken`, va a ser un string y va a tener como valor, el token de epsagon. El segundo, se va a llamar `/pufouniversity/devmanolete/epsagonTokenSecure`, va a ser un secure string encriptado con la clave por defecto, y va a tener como valor el token de epsagon.

Ahora vamos a nuestro fichero `serverless.yml` y cambiamos la línea donde seteábamos la variable de entorno del token por la siguiente:
```
c: ${ssm:/pufouniversity/${self:custom.stage}/epsagonToken}
```

Deploya y todo debería seguir funcionando. 

Vamos a utilizar ahora el secure string. Cambia la variable de entorno por esta:
```
epsagonToken: ${ssm:/pufouniversity/${self:custom.stage}/epsagonTokenSecure~true}
```

Con la "virgulilla" le estamos diciendo al framework que tiene que desencriptar la variable. Una cosa a tener en cuenta es que no hemos añadido ningún permiso en el archivo `serverless.yml` porque la función deployada no necesita de ningún permiso nuevo. Por ahora, quien necesitará el permiso de poder acceder a Parameter Store será el usuario que esté deployando la aplicación, ya seas tú o la build.

Parece que todo sigue funcionando, no? Ya somos súper-seguros? Bueno, no del todo. Lo primero es que si vas al archivo `cloudformation-template-update-stack-json` dentro del directorio `.serverless` y buscas por epsagonToken, verás ahí tu secreto en plano. Como hemos dicho, quien hace la petición a Parameter Store es quien deploya, y a la función se le pasa el valor en plano. Lo segundo, es que las variables de entorno no són lo más seguro. Si alguien, por alguna razón, logra tomar control del contenedor que ejecuta la lambda, obtener las variables de entorno es muy fácil. Si, ya sé, quien diablos va a tomar el control del contendor que ejecuta la lambda? Bueno, cosas más raras se han visto!

Vamos a intentar obtener el token desde dentro de la función. Lo primero, es deshacer unas cuantas cosas de las que hemos hecho. Elimina el fichero `secrets.yml`, quita la línea donde lo cargábamos y elmina la variable de entorno del token de Epsagon. 

Para obtener estos valores, vamos a utilizar una librería de middleware llamada [middy](https://github.com/middyjs/middy). Así que ya puedes añadirla a nuestro proyecto:
```
npm install --save middy
```

También podemos añadir una variable de entorno llamada `stage` porque la vamos a necesitar. Puedes añadirla en el provider para hacerla disponible para todas la funciones:
```
stage: ${self:custom.stage}
```

Ahora es momento de repetir los siguientes pasos en las tres funciones (y en todas las que añadas en un futuro). Importa la librería y el middleware de `ssm`:
```
const middy = require("middy");
const { ssm } = require("middy/middlewares");
```

Guarda la variable de entorno stage en una variable:
```
const { stage } = process.env;
```

Cambia la función handler para que, en lugar de ser directamente un export del módulo, sea una función:
```
const handler = .......
```

Crea el nuevo `module.exports` con la llamada a middy:
```
module.exports.handler = middy(handler).use(
  ssm({
    cache: true,
    cacheExpiryInMillis: 3 * 60 * 1000,
    setToContext: true,
    names: {
      epsagonToken: `/pufouniversity/${stage}/epsagonTokenSecure`
    }
  })
);
```

Le estamos diciendo a middy varias cosas:
 - Que wrappee la función handler
 - Que utilice el middleware ssm
 - Que el middleware lo queremos configurar con:
  - Una caché de 3 minutos
  - Que ponga el valor de lo que lea de parameter store en el contexto (y no en variables de entorno)
  - Los nombres de los `parameters` que queremos que lea y el nombre que queremos que tengan las nuevas variables.

Ahora ya podemos utilizar estos valores. La pega es que deberemos mover la inicialización de epsagon dentro del handler, pues es allí donde tenemos acceso al contexto. Cambia el handler para que reciba siempre los parámetros `event` y `context`. 
```
epsagon.init({
  token: context.epsagonToken,
   appName: `${process.env.service}`,
   metadataOnly: false
});
```

Sólo nos falta una cosa. Ahora si que la función está accediendo a Parameter Store, así que necesitará permisos para poder hacerlo. Añade este permiso a las tres funciones:
```
- Effect: Allow
  Action: ssm:GetParameters*
  Resource: arn:aws:ssm:#{AWS::Region}:#{AWS::AccountId}:parameter/pufouniversity/*
```

El primer asterisco es porque hay dos funciones a las que nos interesa acceder que empiezan igual. El segundo es porque quermos dar permisos para todos los `parameters`.

Haz lo mismo para las tres funciones, deploya y todo debería seguir funcionando correctísimamente!

Sólo nos queda una cosa más para cerrar este paso. Es una buena idea utilzar logging estructurado (un JSON, vamos) en nuestras aplicaciones. Puedes leer más sobre esto [aquí](https://stackify.com/what-is-structured-logging-and-why-developers-need-it/), [aquí](https://blog.treasuredata.com/blog/2012/04/26/log-everything-as-json/) y [aquí](https://www.loggly.com/blog/8-handy-tips-consider-logging-json/). Vamos a cambiar nuestro logging. Crea un archivo llamado `log.js` dentro de `src/lib` con el siguiente contenido:
```
// https://raw.githubusercontent.com/theburningmonk/manning-aws-lambda-in-motion/unit_8.2/lib/log.js
const LogLevels = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
};

// default to debug if not specified
const logLevelName = process.env.log_level || "DEBUG";

function isEnabled(level) {
  return level >= LogLevels[logLevelName];
}

function appendError(params, err) {
  if (!err) {
    return params;
  }

  return Object.assign(params || {}, {
    errorName: err.name,
    errorMessage: err.message,
    stackTrace: err.stack
  });
}

function log(levelName, message, params) {
  if (!isEnabled(LogLevels[levelName])) {
    return;
  }

  const logMsg = Object.assign({}, params);
  logMsg.level = levelName;
  logMsg.message = message;

  console.log(JSON.stringify(logMsg));
}

module.exports.debug = (msg, params) => log("DEBUG", msg, params);
module.exports.info = (msg, params) => log("INFO", msg, params);
module.exports.warn = (msg, params, error) =>
  log("WARN", msg, appendError(params, error));
module.exports.error = (msg, params, error) =>
  log("ERROR", msg, appendError(params, error));

```

Ahora puedes loguear de la siguiente manera:
```
log.info("published 'master_enrolled' event", { masterId, orderId });
```

Si ahora intentas pasar los tests de integracion
```
AWS_PROFILE=serverless-local TEST_STAGE=devmanolete npm run test:integration
```

verás que fallan. Esto es por un pequeño [bug](https://github.com/middyjs/middy/issues/198) en middy. Para solventarlo, tendrás que cambiar ligeramente el fichero `when.js`. La función `viaHandler` te debería de quedar así:
```
async function viaHandler(functionPath) {
  // eslint-disable-next-line import/no-dynamic-require
  const handler = require(`../../src/functions/${functionPath}`);

  // due to https://github.com/middyjs/middy/issues/198
  return new Promise(async (resolve, reject) => {
    const event = {};
    const context = {};
    const callback = (something, response) => {
      response.body = JSON.parse(response.body);
      resolve(response);
    };
    await handler.handler(event, context, callback);
  });
}
```

Esto es porque middy intenta llamar al callback (esto se utilizaba en funciones con node 6) en lugar de devolver la respuesta.

Otra cosa que deberemos hacer es añadir esta línea a la función init del fichero `init.js`:
```
process.env.stage = process.env.TEST_STAGE;
```

Vuelve a pasar los tests y verás que ahora pasan correctamente.

Y ya hemos acabado!

## Paso 5 - Autenticación

// TODO: explicación cognito

Es hora de añadir un poco de seguridad a nuestros endpoints. No queremos que cualquiera se pueda dar de alta en nuestra universidad!! Para mostrar esto, vamos a introducir un nuevo endpoint que recuperará el detalle de un máster. Empecemos por el test. Crear un archivo llamado `getMasterDetails.spec.js` en la carpeta `tests` con el siguiente contenido:
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

Y ahora nos toca crear la identity pool. Crea un archivo en esa misma carpeta llamado `cognito-identity-pool-yml` con el siguiente contenido:
```
Resources:
  # The federated identity for our user pool to auth with
  CognitoIdentityPool:
    Type: AWS::Cognito::IdentityPool
    Properties:
      # Generate a name based on the stage
      IdentityPoolName: ${self:custom.stage}IdentityPool
      # Don't allow unathenticated users
      AllowUnauthenticatedIdentities: false
      # Link to our User Pool
      CognitoIdentityProviders:
        - ClientId:
            Ref: CognitoUserPoolClient
          ProviderName:
            Fn::GetAtt: ["CognitoUserPool", "ProviderName"]

  # IAM roles
  CognitoIdentityPoolRoles:
    Type: AWS::Cognito::IdentityPoolRoleAttachment
    Properties:
      IdentityPoolId:
        Ref: CognitoIdentityPool
      Roles:
        authenticated:
          Fn::GetAtt: [CognitoAuthRole, Arn]

  # IAM role used for authenticated users
  CognitoAuthRole:
    Type: AWS::IAM::Role
    Properties:
      Path: /
      AssumeRolePolicyDocument:
        Version: "2012-10-17"
        Statement:
          - Effect: "Allow"
            Principal:
              Federated: "cognito-identity.amazonaws.com"
            Action:
              - "sts:AssumeRoleWithWebIdentity"
            Condition:
              StringEquals:
                "cognito-identity.amazonaws.com:aud":
                  Ref: CognitoIdentityPool
              "ForAnyValue:StringLike":
                "cognito-identity.amazonaws.com:amr": authenticated
      Policies:
        - PolicyName: "CognitoAuthorizedPolicy"
          PolicyDocument:
            Version: "2012-10-17"
            Statement:
              - Effect: "Allow"
                Action:
                  - "mobileanalytics:PutEvents"
                  - "cognito-sync:*"
                  - "cognito-identity:*"
                Resource: "*"

              # Allow users to invoke our API
              - Effect: "Allow"
                Action:
                  - "execute-api:Invoke"
                Resource:
                  Fn::Join:
                    - ""
                    - - "arn:aws:execute-api:"
                      - Ref: AWS::Region
                      - ":"
                      - Ref: AWS::AccountId
                      - ":"
                      - Ref: ApiGatewayRestApi
                      - "/*"

# Print out the Id of the Identity Pool that is created
Outputs:
  IdentityPoolId:
    Value:
      Ref: CognitoIdentityPool
```

Ya lo tenemos. Es hora de deployar porque vamos a necesitar esos ids que antes hablábamos y no los vamos a tener hasta que no deployemos:
```
SLSUSER=manolete npm run deploy
```

Ahora toca recuperar los ids, y para ello tendremos que ir a la consola. Ve al servicio cognito y selecciona el user pool recién creado. En esa página verás el id, cópiatelo. En esta misma página, en la sección App integration -> App client settings podrás recuperar el cognito server client id. Y finalmente, si vuelves al servicio cognito y seleccionas el identity pool, si le clicas sobre el botón de edit podrás recuperar el id del identiy pool.

Ya estamos un poco más cerca de poder lanzar los tests, nos falta poder setear estos valores como variables de entorno. Para hacerlo, utilizaremos un fichero .env. Hay que tener en cuenta que no queremos subir este fichero al repositorio, así que edita el fichero `.gitignore` y añade el fichero `.env`. Para cargar este fichero utilizaremos una libreria llamada dotnev. Ve a tu terminal y añádela al proyecto como dev dependency.
```
npm install dotenv --save-dev
```

Crea un fichero llamado `.env` en la raiz de tu proyecto y añade los ids que acabamos de recuperar. Tu fichero debería tener esta pinta:
```
cognitoUserPoolId=eu-west-1_XXXXXXXX
identityPoolId=eu-west-1:XXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXX
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
