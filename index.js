const express = require('express')
const cors = require('cors')
const cookieParser = require('cookie-parser')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config()
const port = process.env.PORT || 5000
const app = express()
// const corsOptions = {
//   origin: [
//     'http://localhost:5173/',
//     'http://localhost:5174/',


//   ],
//   credentials: true,
//   optionSuccessStatus: 200,
// }

app.use(cors())
app.use(express.json())
app.use(cookieParser())


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.zl2zuuz.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    const usersCollection = client.db("petZoneDB").collection("users");

    app.get('/users', async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    })
    app.delete("/users/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await usersCollection.deleteOne(query);
      res.send(result)

    })
    app.patch("/users/admin/:id",  async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: 'admin'
        },
      };
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result)

    })
    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email }
      const isExist = await usersCollection.findOne(query);
      if (isExist) {
        return res.send({ message: "user already exist", insertedId: null })
      }
      const result = await usersCollection.insertOne(user);
      res.send(result)
    })
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send('server is running')
})

app.listen(port, (req, res) => {
  console.log(`server is running at: http://localhost:${port}`);
})



