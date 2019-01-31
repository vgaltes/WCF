# NO ME PUEDO CREER QUE PUEDA HACER UNA APLICACIÓN SERVERLESS EN DOS HORAS

Hola, bienvenido a este workshop sobre Serverless en AWS. El objetivo de este workshop es darte las herramientas necesarias para que si vas a empezar en breve un proyecto Serverless, lo hagas de una manera séria y profesional. Veremos cosas como testing, seguridad, logging, monitorización, integración contínua, etc.

Antes de empezar necesitaria que configuraras unas cuantas cosas en tu ordenador. Debes hacer esto **antes** de venir al workshop por dos razones:
 - No perder el tiempo en los preparativos durante el workshop y así sacar el máximo provecho de él.
 - Algunas cuentas pueden tardar unas horas en activarse. Si lo haces al principio del workshop puede ser que no tengas la cuenta activa durante el mismo.

## Cuenta en AWS
Vamos a utilizar AWS Lambda, así que necesitas tener una cuenta en AWS. No te preocupes, puedes crear una cuenta gratuita sin problemas [aquí](https://aws.amazon.com/free/start-your-free-trial/).

Vamos a necesitar un par de usuarios en tu cuenta para el workshop. Uno será el que utilizaremos en local para desplegar y probar la aplicación. El segundo será el que utilizará nuestro sistema de integración contínua para desplegar y probar la aplicación. Vamos a por ello: repite los siguientes pasos dos veces (una por usuario) con diferentes nombres de usuario.
 - Haz login en tu cuenta de AWS y ve a la página Identity & Access Management (IAM)
 - Haz click en Users y después en Add User. Introduce `serverless-local` como nombre para el primer usuario y `serverless-agent` como nombre para el segundo usuario. Activa Programmatic Access. Haz click en Next para ir a la página de permisos. Haz click en Attach existing policies directly y selecciona la policy llamada AdministratorAccess (la primera).
 - Clica en Next: tags. 
 - Clica en Next: review. Chequea que todo está bien y clica en Create user. 
 - Visualiza y copia la API Key y el Secret a un lugar temporal. Lo necesitaremos más tarde.

Esto no es una buena práctica. La buena práctica sería dar los mínimos permisos posibles a este usuario (y a todos). Para hacerlo, crearíamos una policy en la que especificaríamos los mínimos permisos (algo como lo que puedes encontrar [aqui](https://gist.githubusercontent.com/ServerlessBot/7618156b8671840a539f405dea2704c8/raw/bfc213d5b20ad0192217d5035ff526792535bdab/IAMCredentials.json)) y asiganaríamos esa policy al usurio. Cada vez que viéramos que nos falta un permiso, deberíamos cambiar la policy. Para no tener que ir haciendo esto cada dos por tres, asignamos el usuario al grupo Administrators, pero no debéis hacer esto en un proyecto en producción. Hay herramientas que nos pueden ayudar como [esta](https://www.trek10.com/blog/excess-access-exorcism-with-aws-config/) o [esta](https://github.com/dancrumb/generator-serverless-policy).

## Cuenta en Epsagon
En el paso 4 vamos a utilizar una herramienta de monitorización llamada Epsagon. Tendrías que prepararla para que todo nos vaya fluido. Ve a su [página web](https://epsagon.com/) y date de alta en el servicio gratuito. Cuando te des de alta, te explicarán lo que tienes que hacer. Básicamente deberás desplegar un CloudFormation en tu cuenta AWS y anotarte el Token que utilizaremos después.

## Cómo avanzar en este workshop
Para poder ir avanzando en el workshop, vas a tener que ser capaz de ir subiendo tus cambios al repositorio a medida que vayamos avanzando para que el sistema de integración contínua pueda hacer su trabajo. Por lo tanto, puedes hacer tres cosas:
 - Clonar este repositorio y trabajar siempre en master. Haz tus cambios en master y súbelos. Si necesitas ver como está un archivo en una rama en concreto, siempre puedes venir al [repositorio original](https://github.com/vgaltes/wcf) y mirar como está.
 - Forkear este repositorio y trabajar siempre en master. Haz tus cambios en master y súbelos. Si necesitas ver como está un archivo en una rama en concreto, siempre puedes venir al [repositorio original](https://github.com/vgaltes/wcf) y mirar como está.
 - Crearte tu propio repositorio vacío y copiarte los ficheros que hay en master.
 
Cualquiera de las tres opciones es buena. Sólo recuerda que si escoges la solución 1 o 2, si vas a una rama, tendrás la solución final para esa rama.

## Creación de un profile en nuestro ordenador.
Ahora es la hora de configurar nuestro ordenador para que utilice estas credenciales a la hora de desplegar nuestra aplicación. Hay varias maneras de hacer esto pero la mejor es utilizar un profile y que este no sea el profile por defecto, para evitar posibles desgracias en el futuro.

Para setear este profile hay varias maneras, pero la más cómoda es utilizar el propio [Serverless framework](https://serverless.com). Así que clona o "forkea" este repositorio e instala los paquetes npm utilizando el comando `npm install`. Una vez instalados, ejecuta el siguiente comando: `./node_modules/.bin/serverless config credentials --provider aws --key <tu_key> --secret <tu_secret> --profile serverless-local`

Dónde `tu_key` y `tu_secret` son los datos que nos hemos guardado del paso anterior para el usuario serverless-local. Las claves para el usuario serverless-agent las utilizaremos más tarde, así que guárdalas bien. Con esto ya tendremos el profile creado.

## Cómo deployar
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

## Primer deploy
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
