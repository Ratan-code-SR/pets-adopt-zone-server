const express = require('express')
const cors = require('cors')
const cookieParser = require('cookie-parser')
var jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config()
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
const port = process.env.PORT || 5000
const app = express({
  origin: [
    "http://localhost:5173",
    "https://petadoptzone.netlify.app",
    "https://petadoptzone.web.app/",
  ]
})


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
    const adoptRequestCollection = client.db("petZoneDB").collection("adopt");
    const paymentsCollection = client.db("petZoneDB").collection("payments");
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

    app.get("/users/admin/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email }
      const user = await usersCollection.findOne(query)
      let admin = false;
      if (user) {
        admin = user?.role == 'admin'
      }
      res.send({ admin })

    })

    app.delete("/users/:id", verifyToken, async (req, res) => {
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
    app.get('/pets', async (req, res) => {
      const result = await petsCollection.find().toArray();
      res.send(result);
    })

    app.get('/searchPets', async (req, res) => {
      const searchQuery = req.query.q || '';
      const category = req.query.category || 'All';
      const query = {
        adopted: 'false',
        name: { $regex: searchQuery, $options: 'i' }
      };
      if (category !== 'All') {
        query.category = category;
      }
      const pets = await petsCollection.find(query).sort({ addedDate: -1 }).toArray();
      res.send(pets);
    });

    app.get('/pets/email/:email', verifyToken, async (req, res) => {
      const email = req.params.email;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;

      const query = { email: email };
      const pets = await petsCollection.find(query).skip(skip).limit(limit).toArray();
      const totalCount = await petsCollection.countDocuments(query);

      res.send({ pets, totalCount });
    });


    app.get('/pets/:id', async (req, res) => {
      const id = req.params.id
      const query = { _id: new ObjectId(id) }
      const result = await petsCollection.findOne(query);
      res.send(result);
    })

    app.post("/pets", async (req, res) => {
      const user = req.body;
      const result = await petsCollection.insertOne(user);
      res.send(result)
    })

    app.delete('/pets/:id', verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await petsCollection.deleteOne(query);
      res.send(result)
    })

    app.patch("/pets/:id", verifyToken, async (req, res) => {
      const pet = req.body;
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          name: pet.name,
          category: pet.category,
          location: pet.location,
          description: pet.description,
          longDescription: pet.longDescription,
          petImage: pet.petImage,
          age: pet.age,
          adopted: pet.adopted
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


    app.get('/donations/donationsEmail/:email', verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await donationCollection.find(query).toArray();
      res.send(result);
    })

    app.get('/donations/:id', async (req, res) => {
      const id = req.params.id
      const query = { _id: new ObjectId(id) }
      const result = await donationCollection.findOne(query);
      res.send(result);
    })

    app.patch("/donations/:id", verifyToken, async (req, res) => {
      const donations = req.body;
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          petName: donations.petName,
          shortDescription: donations.shortDescription,
          longDescription: donations.longDescription,
          maximumAmount: donations.maximumAmount,
          petImage: donations.petImage
        },
      };
      const result = await donationCollection.updateOne(filter, updateDoc);
      res.send(result)

    })
    app.delete('/donations/:id', verifyToken,  async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await donationCollection.deleteOne(query);
      res.send(result)
    })
    app.post("/donations", async (req, res) => {
      const user = req.body;
      const result = await donationCollection.insertOne(user);
      res.send(result)
    })

    // In your donations-related API
    app.patch("/donations/pause/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const { isPaused } = req.body;

      try {
        const result = await donationCollection.updateOne(filter, { $set: { isPaused } });
        res.send(result);
      } catch (error) {
        console.error("Error pausing donation:", error);
        res.status(500).send({ error: "Internal Server Error" });
      }
    });


    // adopted related api
    app.post("/adopt", async (req, res) => {
      const user = req.body;
      const result = await adoptRequestCollection.insertOne(user);
      res.send(result)
    })

    app.patch("/adopt/:id", async (req, res) => {
      const pet = req.body;
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          adopted: pet.adopted
        },
      };
      // console.log("hello",pet.adopted);
      const result = await adoptRequestCollection.updateOne(filter, updateDoc);
      res.send(result)
    })

    app.get('/adopt/adoptEmail/:email', async (req, res) => {
      const email = req.params.ownerEmail;
      const query = { email: email };
      const result = await adoptRequestCollection.find(query).toArray();
      res.send(result);
    })
   
    app.get('/adopt/request', async (req, res) => {
      const result = await adoptRequestCollection.find().toArray();
      res.send(result);
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
    // payment related api
    app.post("/payments", async (req, res) => {
      const payments = req.body;
      const paymentsResult = await paymentsCollection.insertOne(payments);
      res.send(paymentsResult)
    })

    app.get('/payments', async (req, res) => {
      const result = await paymentsCollection.find().toArray();
      res.send(result);
    })

    app.get('/payments/:id', verifyToken, async (req, res) => {
      const id = req.params.id
      const query = { _id: new ObjectId(id) }
      const result = await paymentsCollection.findOne(query);
      res.send(result);
    })
    app.get('/payments/paymentsEmail/:email', verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await paymentsCollection.find(query).toArray();
      res.send(result);
    })
    app.delete('/payments/:id', verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await paymentsCollection.deleteOne(query);
      res.send(result)
    })

    // payment intent related api
    app.post("/create-payment-intent", async (req, res) => {
      const { donateAmount } = req.body;
      const amount = parseInt(donateAmount * 100);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ['card'],
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
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



