# NO ME PUEDO CREER QUE PUEDA HACER UNA APLICACIÓN SERVERLESS EN DOS HORAS

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

Efectivamente, el error es diferente. Vamos mejorando. Lo que pasa es que el test fallará porque tenemos una implementación un tanto sucia del primer ejemplo. Cambia el contenido del fichero por este:
```
module.exports.handler = async event => {
  const res = {
    statusCode: 200,
    body: JSON.stringify(`Hello`)
  };

  return res;
};
```
Esto hará que los tests no fallen porque no encuentran el parámetro name.

Lo que vamos a querer ahora, es recuperar los masters de una base de datos. Para ello vamos autilizar DynamoDB con la nueva característica que tiene de pago por uso. Y para definirla, vamos a incorporar una nueva sección al fichero `serverless.yml` que es la de los recursos. El framework nos permite definir recursos de CloudFormation directamente en el fichero, de manera que serán deployados cuando deployemos el servicio entero. Vamos a definir nuestra tabla de DynamoDb. Añade esto al final del fichero `serverless.yml`:

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

Aquí aplica lo mismo que antes. Podemos quitar la línea donde seteamos la variable `mastersTable` y dejar que cada usuario la setee al llamar a los tests. Por ahora nos vale esto a nosotros, así que lo podemos dejar de esta manera.

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
