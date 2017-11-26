const express = require("express")
const cors = require("cors")
const { MongoClient } = require("mongodb")
const bodyParser = require("body-parser")

const PORT = 2000

express()
  .use(cors())
  .use(bodyParser.json())

  .get("/tasks", async (request, response) => {
    let db
    try {
      db = await MongoClient.connect(process.env.MONGO_URL)

      const tasksCollection = db.collection("tasks")
      const allTasks = tasksCollection.find().sort("_id", -1)

      response.status(200).send({ items: await allTasks.toArray() })
    } catch (error) {
      response.status(500).send({ error })
      console.error(error)
    } finally {
      if (db) db.close()
    }
  })

  .post("/tasks", async (request, response) => {
    let db
    try {
      db = await MongoClient.connect(process.env.MONGO_URL)

      const newTask = {
        ...request.body,
        isComplete: false
      }

      const tasksCollection = db.collection("tasks")
      const insertResult = await tasksCollection.insertOne(newTask)

      if (!insertResult.result.ok) {
        throw Error("Couldn't add to database")
      }

      response.status(201).send({ item: newTask })
    } catch (error) {
      response.status(500).send({ error })
      console.error(error)
    } finally {
      if (db) db.close()
    }
  })

  .put("/tasks/:taskId", async (request, response) => {
    let db
    try {
      db = await MongoClient.connect(process.env.MONGO_URL)

      const tasksCollection = db.collection("tasks")

      const { taskId } = request.params
      const newTask = request.body

      const replaceResult = await tasksCollection.replaceOne(
        { _id: ObjectId(taskId) },
        newTask
      )

      if (!replaceResult.result.ok) {
        throw new Error("Couldn't update database")
      }

      response.sendStatus(204)
    } catch (error) {
      response.status(500).send({ error })
      console.error(error)
    } finally {
      if (db) db.close()
    }
  })

  .delete("/tasks/:taskId", async (request, response) => {
    let db
    try {
      db = await MongoClient.connect(process.env.MONGO_URL)

      const tasksCollection = db.collection("tasks")

      const { taskId } = request.params

      const deleteResult = await tasksCollection.findOneAndDelete({
        _id: ObjectId(taskId)
      })

      if (!deleteResult.ok) {
        throw new Error("Couldn't update database")
      }

      console.log(deleteResult.value)

      response.status(200).send({ item: deleteResult.value })
    } catch (error) {
      response.status(500).send({ error })
      console.error(error)
    } finally {
      if (db) db.close()
    }
  })

  .listen(API_PORT, () => {
    console.log("Serving API.")
  })
