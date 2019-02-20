# NO ME PUEDO CREER QUE PUEDA HACER UNA APLICACIÓN SERVERLESS EN DOS HORAS

## Paso 6 - Cliente web

Es hora de poner un cliente web a charlar con nuestro serverless backend. Aunque primero vamos a hacer unos pequeñísimos cambios.

Lo que queremos hacer antes de ponernos con el cliente es a) securizar el endpoint enrolMaster, b) utilzar el correo del usuario logueado en el mail que enviamos y en los mensajes de SNS y c) activar CORS para que el cliente pueda acceder al backend. Vamos a por ello.

Lo primero que vamos a hacer es securizar el endpont enrolMaster. Edita el fichero `serverless.yml` y ve al evento http de la función enrolMaster. Añádele el authorizer y de paso le cambias un poco el path para sacarle la s extra. Te debería quedar algo así:
```
enrollMaster:
    handler: src/functions/enrollMaster.handler
    events:
      - http:
          path: api/master
          method: post
          authorizer:
            arn: arn:aws:cognito-idp:#{AWS::Region}:#{AWS::AccountId}:userpool/${self:custom.vars.userPoolId}
```

Ahora vamos a recuperar el mail del usuario y utilizarlo en las funciones. Empezamos editando el fichero `src/functions/enrollMaster.js`. Justo después de parsear el body puedes añadir esta línea:
```
const userEmail = event.requestContext.authorizer.claims.email;
```

Como ves, la información de cognito nos viene dentro del evento.

Ahora ya podemos utilizar este mail. Si quieres puedes cambiar las líneas de logging para añadirlo (cuidado con esto en producción ya que no podemos loguear PII), pero lo más importante es que lo añadas al evento de Kinesis:
```
const data = {
  orderId,
   masterId,
   userEmail,
   eventType: "master_enrolled"
};

```

Ya que lo estamos enviando, lo tendremos que recuperar para añadirlo al mail que enviamos a la universidad. Edita el fichero `src/function/notifyUniversity.js`. Edita la primera línea del for para que te quede algo como esto:
```
const emailParams = generateEmail(order.orderId, order.masterId, order.userEmail);
```

y cambia la función `generateEmail` para utilizar el correo:
```
function generateEmail(orderId, masterId, userEmail) {
  return {
    Source: emailAddress,
    Destination: { ToAddresses: [emailAddress] },
    ReplyToAddresses: [emailAddress],
    Message: {
      Body: {
        Text: {
          Charset: "UTF-8",
          Data: `User with email ${userEmail} has enrolled to master ${masterId} with order id ${orderId}`
        }
      },
      Subject: {
        Charset: "UTF-8",
        Data: `[PufoUniversity] new enrollment`
      }
    }
  };
}
```

Finalmente es hora de añadir CORS. Esto consiste en dos pasos. El primero es editar el fichero `serverless.yml` para añadir cors a los endpoints. Vamos a activar CORS para todo el mundo, pero en tu proyecto puedes ser más restrictivo. Añade esta línea a todos los eventos http:
```
cors: true
```

El segundo paso necesario para añadir CORS es devolver la cabecera adecuada. Si nos fijamos como ejemplo en el endpoint getMasters, deberíamos devolver algo así:
```
const res = {
    statusCode: 200,
    headers: {
      "Access-Control-Allow-Origin": "*"
    },
    body: JSON.stringify(resp.Items)
  };
```

Como ves, estamos añadiendo la cabecera "Access-Control-Allow-Origin". Tienes más información sobre CORS y el framework Serverless [aquí](https://serverless.com/blog/cors-api-gateway-survival-guide/). Debes hacer lo mismo para los otros endpoints con un evento http.

Ya puedes guardar los cambios y pushearlos para deployar la app.

Ahora si, es el momento de crear nuestro cliente web. No tengo ni idea de desarrollo front end, así que no pretendo explicarte como va react ni nada parecido. Pero si que me gustaría explicarte un poco como va la integración con AWS Lambda y a deployarlo con Netlify.

Ve [este](https://github.com/vgaltes/WCFClient) repositorio y forkéatelo en tu cuenta. La primera cosa a mirar es el fichero `config.js`. Aquí vemos que los valores de la región, url de la api y ids de cognito son por ahora un placeholder. Cuando deployemos veremos como las setamos.

Esto lo utilizaremos para configurar AWS Amplify, que es una librería de AWS que podemos utilizar para autenticarnos con cognito y hacer llamadas autenticadas a nuestro backend. En el fichero `index.js` verás como se configura la librería. Básicamente le estamos dando la información de cognito y de nuestra api. La parte quizá más interesante es el campo `custom_header` donde le decimos como queremos que pase la cabecera de autenticación, en nuestro el token jwt.

En el fichero `Home.js` es dónde estamos recuperando la lista de másters. Como es una llamada no autenticada, la podemos realizar con superagent. 

En el fichero `Master.js` estamos haciendo dos cosas. Por una parte, estamos recuperando la información de un máster en concreto utilizando AWS Amplify. Por otra parte, estamos llamando al endpoint enrolMaster pasándole el id del master. Pero para hacer estas llamadas necesitamos estar autenticados. Como hacemos un signup y un login?

Puedes ver como se hace un signup en el fichero `signup.js`. Como ves, con la ayuda del módulo `Auth` de AWS Amplify, se hace de una manera muy fácil. El signin lo puedes ver en el fichero `login.js`. Una vez más, AWS Amplify nos abstrae de toda la complejidad.

Es hora de deployar nuestro cliente y lo haremos con la ayuda de Netlify. 

Verás que en la raíz del proyecto web hay un fichero llamado `netlify.toml`. En este fichero podemos definir cosas que sobreescribirán las que se hayan definido en la UI. Como ves estamos definiendo el script a ejecutar y el directorio de publicación de la web, y también estamos definiendo las variables de entorno para producción (rama master) i sit (rama sit). Aquí deberías poner tus valores. Un apunte importante a hacer es que estas variables son válidas cuando se hace la build de la página, no cuando se ejecuta el site. Si intentamos acceder a estas variables desde nuestro site recibiremos un undefined.

Es por eso que en el fichero `buildClient.sh` substituimos los placeholders por los valores que tenemos en las variables de entorno, porque este fichero se ejecuta en tiempo de compilación del site.

Ahora ve a tu cuenta de Netlify y clica en `New site from git`. Selecciona GitHub como tu repositorio y selecciona el repositorio donde tienes el cliente web. Como build command asegúrate que está `./buildClient.sh`, que es nuestro pequeño script para deployar la web y como publish directory asegúrate que está `build`, que es donde los react scripts dejan la web. Clica en deploy site y verás como mágicamente se deploya tu web.

Ahora ves a `Deploy settings` y en el apartado `Deploy contexts` clica en `edit settings`. En `Branch deploys` selecciona `Let me add individual branches` y escribe `sit` y clica en `Add branch sit`. Esto hará que cuando pusheemos a sit, se arrancará un nuevo deployment. Por lo tanto, ves a tu repositorio, crea una rama llamda sit, haz un pequeño cambia y haz push a ver que tal.

Para que la web en producción nos funcione nos faltan un par de cosas:
 - Añadir los parámetros `pufouniversity/prod/epsagonToken` y `pufouniversity/prod/epsagonTokenSecure` a parameter store con el valor adecuado.
 - Llenar la base de datos de datos llamando al script. Para esto, puedes crear un par de scripts extras en el `package.json`:
  ```
  "seedMasters:sit": "node seedMasters.js masters-sit",
  "seedMasters:prod": "node seedMasters.js masters-prod",
  ```
  Y entonces llamarlo via `AWS_PROFILE=serverless-local npm run seedMasters:prod`

Si ahora vas a la web, ya sea sit o producción, todo te debería funcionar correctamente.