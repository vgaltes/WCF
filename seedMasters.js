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