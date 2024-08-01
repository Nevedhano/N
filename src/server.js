// server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json());

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/nft-marketplace', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

// Define a schema
const nftSchema = new mongoose.Schema({
    tokenId: String,
    owner: String,
    imageUri: String,
    price: String,
});

const NFT = mongoose.model('NFT', nftSchema);

// API endpoint to save an NFT
app.post('/nfts', async (req, res) => {
    const { tokenId, owner, imageUri, price } = req.body;
    const nft = new NFT({ tokenId, owner, imageUri, price });
    await nft.save();
    res.status(201).send(nft);
});

// API endpoint to get all NFTs
app.get('/nfts', async (req, res) => {
    const nfts = await NFT.find();
    res.status(200).send(nfts);
});

// API endpoint to get NFTs by owner
app.get('/nfts/:owner', async (req, res) => {
    const { owner } = req.params;
    const nfts = await NFT.find({ owner });
    res.status(200).send(nfts);
});

app.listen(5000, () => {
    console.log('Server is running on port 5000');
});
