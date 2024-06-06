const express = require('express')
const cors = require('cors')
const cookieParser = require('cookie-parser')
var jwt = require('jsonwebtoken');
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
    const petsCollection = client.db("petZoneDB").collection("pets");
    const donationCollection = client.db("petZoneDB").collection("donation");
    const reviewCollection = client.db("petZoneDB").collection("reviews");
    // jwt related api
    app.post('/jwt', (req, res) => {
      const user = req.body
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
      res.send({ token })
    })

    // middleware 
    const verifyToken = (req, res, next) => {
      if (!req.headers.authorization) {
        return res.status(401).send({ message: 'unauthorized access' });
      }
      const token = req.headers.authorization.split(' ')[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: 'unauthorized access' })
        }
        req.decoded = decoded;
        next();
      })
    }

    // use verify admin after verifyToken
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const isAdmin = user?.role === 'admin';
      if (!isAdmin) {
        return res.status(403).send({ message: 'forbidden access' });
      }
      next();
    }
    // users related api
    app.get('/users', verifyToken, async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    })

    app.get("/users/admin/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: 'unauthorized access' })
      }
      const query = { email: email }
      const user = await usersCollection.findOne(query)
      let admin = false;
      if (user) {
        admin = user?.role == 'admin'
      }
      res.send({ admin })

    })

    app.delete("/users/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await usersCollection.deleteOne(query);
      res.send(result)

    })
    app.patch("/users/admin/:id", verifyToken, verifyAdmin, async (req, res) => {
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

    // pets related api
    app.get('/pets', verifyToken, async (req, res) => {
      const result = await petsCollection.find().toArray();
      res.send(result);
    })

    app.post("/pets", async (req, res) => {
      const user = req.body;
      const result = await petsCollection.insertOne(user);
      res.send(result)
    })

    app.delete('/pets/owner/:id', verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await petsCollection.deleteOne(query);
      res.send(result)
    })

    app.patch("/pets/owner/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: 'admin'
        },
      };
      const result = await petsCollection.updateOne(filter, updateDoc);
      res.send(result)

    })
    // pets donations related api
    app.get('/donations', verifyToken, async (req, res) => {
      const result = await donationCollection.find().toArray();
      res.send(result);
    })

    app.post("/donations", async (req, res) => {
      const user = req.body;
      const result = await donationCollection.insertOne(user);
      res.send(result)
    })

    // review related api
    app.post("/reviews", async (req, res) => {
      const user = req.body;
      const result = await reviewCollection.insertOne(user);
      res.send(result)
    })
    app.get('/reviews', async (req, res) => {
      const result = await reviewCollection.find().toArray();
      res.send(result);
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



