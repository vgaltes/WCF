# NO ME PUEDO CREER QUE PUEDA HACER UNA APLICACIÓN SERVERLESS EN DOS HORAS

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