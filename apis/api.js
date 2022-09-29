const AWS = require("aws-sdk");
const express = require("express");
const serverless = require("serverless-http");
const app = express();
const JwtHelper = require("../helpers/JwtHelper");
const hash = require('object-hash');
const { validate, ValidationError, Joi } = require('express-validation')

const personCreateValidation = {
  body: Joi.object({
    email: Joi.string()
      .email()
      .required(),
    firstName: Joi.string()
        .required(),
    lastName: Joi.string()
        .required(),
    phoneNumber: Joi.string()
    .required(),
    address: Joi.object({
      street: Joi.string()
      .required(),
      houseNumber: Joi.string()
      .required(),
      postalCode: Joi.string()
      .required(),
      city: Joi.string()
      .required(),
      street: Joi.string()
      .required(),
      country: Joi.string()
      .required(),
      state: Joi.string()
      .required()
    })
  }),
}


const PERSON_TABLE = process.env.PERSON_TABLE;
const dynamoDbClientParams = {};
if (process.env.IS_OFFLINE) {
  dynamoDbClientParams.region = 'localhost'
  dynamoDbClientParams.endpoint = 'http://localhost:8000'
}
const dynamoDbClient = new AWS.DynamoDB.DocumentClient(dynamoDbClientParams);

app.use(express.json());

app.post("/persons", validate(personCreateValidation, {}, {}), async function (req, res) {

  const { firstName, lastName, phoneNumber, email, address } = req.body;
  const user = JwtHelper.verify(req);

  // Data Validation. 
  const params = {
    TableName: PERSON_TABLE,
    Item: {
      personId: hash({firstName, lastName, phoneNumber}),
      createdBy: user.id,
      addressId: hash(address),
      firstName,
      lastName,
      phoneNumber,
      email,
      address,
      createdAt: Date.now(),
      updateAt: Date.now(),
    }
  };

  try {
    await dynamoDbClient.put(params).promise();
    res.json({
      status: "OK",
      mmessage: "Person created successfully.",
      person: params.Item
    });

  } catch (error) {
    console.log(error);
    res.status(500).json({ error });
  }
});

app.post("/persons/filter", async function (req, res) {

  let params = {
    TableName: PERSON_TABLE,
    Limit: 20,
    ProjectionExpression: "personId, userId, addressId, firstName, lastName, phoneNumber, email, address"
  };

  let operation = 'scan';

  // if Person Id is not empty then show all the results which belong to a person. 
  const { listType, personId } = req.body;
  if (personId && personId.length) {
    params = {
      ...params,
      KeyConditionExpression: 'personId = :pId',
      ExpressionAttributeValues: { ":pId": personId },
    }
    operation = 'query';
  }
  
  if (listType && listType == 'mine') {
    const user = JwtHelper.verify(req);
    params = {
      ...params,
      IndexName: 'createdByIndex',
      KeyConditionExpression: 'createdBy = :cBy',
      ExpressionAttributeValues: { ":cBy": user.id },
      ScanIndexForward: false
    }
    operation = 'query';
  }

  try {
    dynamoDbClient[operation](params, function (err, data) {
      if (err) {
        res.status(500).json({ error: err });
      } else {
        res.json(data);
      }
    });

  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Could not filter persons data" });
  }

});

app.get("/persons/:personId", async function (req, res) {
  const params = {
    TableName: PERSON_TABLE,
    Key: {
      personId: req.params.personId
    },
  };

  try {
    const { Item } = await dynamoDbClient.get(params).promise();
    if (Item) {
      res.json(Item);
    } else {
      res.status(404).json({ error: 'Could not find person with provided "personId"' });
    }

  } catch (error) {
    console.log(error);
    res.status(500).json({ error });
  }
});

app.use((req, res, next) => {
  return res.status(404).json({
    error: "Not Found",
  });
});

app.use(function(err, req, res, next) {
  if (err instanceof ValidationError) {
    res.status(422).json({ error: err });
  }
  res.status(500).json({ error: err });
})


module.exports.handler = serverless(app);
