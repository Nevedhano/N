import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { Bonanza_abi } from './NFT_abi'; // Ensure correct ABI import
import './NFTImageFetcher.css';
import axios from 'axios';

const nftContractAddress = '0xF7b3D9FCC3Cbb602dadeb055a53c7898789031c0'; // Replace with your NFT contract address
const pinataApiKey = 'd412d28403144441fa5a'; // Replace with your Pinata API key
const pinataSecretApiKey = '69836f8f0767011e1d8375728effcbfe055ae19f844042c591f56b0da5ca72dd';

const NFTImageFetcher = () => {
    const [isConnected, setIsConnected] = useState(false);
    const [signerAddress, setSignerAddress] = useState(null);
    const [signer, setSigner] = useState(null);
    const [nftContract, setNftContract] = useState(null);
    const [price, setPrice] = useState('');
    const [mintedNFTs, setMintedNFTs] = useState([]);
    const [userNFTs, setUserNFTs] = useState([]);
    const [error, setError] = useState('');
    const [activeTab, setActiveTab] = useState('mint'); // 'mint', 'myNFTs', 'mintedNFTs'
    const [selectedFile, setSelectedFile] = useState(null);

    useEffect(() => {
        if (window.ethereum) {
            window.ethereum.on('accountsChanged', handleAccountChange);
        }

        if (nftContract) {
            fetchMintedNFTs();
        }

        return () => {
            if (window.ethereum) {
                window.ethereum.removeListener('accountsChanged', handleAccountChange);
            }
        };
    }, [signerAddress, nftContract]);

    const handleAccountChange = async (accounts) => {
        if (accounts.length > 0) {
            const newSignerAddress = accounts[0];
            const provider = new ethers.providers.Web3Provider(window.ethereum);
            const signer = provider.getSigner();
            const contract = new ethers.Contract(nftContractAddress, Bonanza_abi, signer);
            setSigner(signer);
            setNftContract(contract);
            setSignerAddress(newSignerAddress);
            setIsConnected(true);
        } else {
            setIsConnected(false);
            setSignerAddress(null);
            setSigner(null);
            setNftContract(null);
        }
    };

    const connectToMetaMask = async () => {
        if (window.ethereum) {
            try {
                await window.ethereum.request({ method: 'eth_requestAccounts' });
                const provider = new ethers.providers.Web3Provider(window.ethereum);
                const signer = provider.getSigner();
                setSigner(signer);
                const contract = new ethers.Contract(nftContractAddress, Bonanza_abi, signer);
                setNftContract(contract);
                const address = await signer.getAddress();
                setSignerAddress(address);
                setIsConnected(true);
            } catch (error) {
                console.error('Error connecting to Ethereum provider:', error);
                setError('Error connecting to Ethereum provider. Please check your MetaMask and refresh the page.');
            }
        } else {
            setError('MetaMask is not installed');
        }
    };

    const uploadToIPFS = async (file) => {
        const formData = new FormData();
        formData.append('file', file);

        const metadata = JSON.stringify({
            name: file.name,
            keyvalues: {
                exampleKey: 'exampleValue'
            }
        });

        formData.append('pinataMetadata', metadata);

        const options = JSON.stringify({
            cidVersion: 0,
        });

        formData.append('pinataOptions', options);

        try {
            const res = await axios.post('https://api.pinata.cloud/pinning/pinFileToIPFS', formData, {
                maxContentLength: 'Infinity',
                headers: {
                    'Content-Type': `multipart/form-data; boundary=${formData._boundary}`,
                    'pinata_api_key': pinataApiKey,
                    'pinata_secret_api_key': pinataSecretApiKey
                }
            });
            console.log('Image uploaded to IPFS:', res.data.IpfsHash); // Debugging log
            return res.data.IpfsHash;
        } catch (error) {
            console.error('Error uploading file to IPFS:', error);
            setError('Error uploading file to IPFS');
            return null;
        }
    };

    const createMetadata = async (imageHash, price) => {
        const metadata = {
            name: 'NFT Name',
            description: 'NFT Description',
            image: `ipfs://${imageHash}`,
            price: price,
        };

        try {
            const res = await axios.post('https://api.pinata.cloud/pinning/pinJSONToIPFS', metadata, {
                headers: {
                    'Content-Type': 'application/json',
                    'pinata_api_key': pinataApiKey,
                    'pinata_secret_api_key': pinataSecretApiKey
                }
            });
            console.log('Metadata uploaded to IPFS:', res.data.IpfsHash); // Debugging log
            return `ipfs://${res.data.IpfsHash}`;
        } catch (error) {
            console.error('Error uploading metadata to IPFS:', error);
            setError('Error uploading metadata to IPFS');
            return null;
        }
    };

    const mintNFT = async (price) => {
        if (!selectedFile) {
            setError('Please select a file to upload');
            return;
        }

        try {
            const imageHash = await uploadToIPFS(selectedFile);
            if (!imageHash) {
                return;
            }

            const tokenURI = await createMetadata(imageHash, price);
            if (!tokenURI) {
                return;
            }

            if (!nftContract) {
                setError('NFT contract not initialized.');
                return;
            }

            const transaction = await nftContract.safeMint(tokenURI);
            const receipt = await transaction.wait();
            console.log('Token minted successfully!', receipt); // Debugging log

            // Get the token ID of the minted NFT from the transaction receipt
            const event = receipt.events.find(event => event.event === 'Transfer');
            const tokenId = event.args[2].toString();

            const newNFT = { id: tokenId, tokenURI, imageUri: `https://gateway.pinata.cloud/ipfs/${imageHash}`, price, owner: signerAddress };
            const updatedUserNFTs = [...userNFTs, newNFT];
            setUserNFTs(updatedUserNFTs);

            setError('');
        } catch (error) {
            console.error('Error minting token:', error);
            setError(`Error minting token`);
        }
    };

    const fetchMintedNFTs = async () => {
        try {
            
            const totalSupply = await nftContract.tokenCounter();
            const nfts = [];
            for (let i = 1; i <= totalSupply; i++) {
                const tokenURI = await nftContract.tokenURI(i);
                const owner = await nftContract.ownerOf(i);
                const tokenURIGateway = tokenURI.replace('ipfs://', 'https://gateway.pinata.cloud/ipfs/');
                const response = await axios.get(tokenURIGateway);
                const metadata = response.data;
                console.log(metadata);
                const imageUri = metadata.image.replace('ipfs://', 'https://gateway.pinata.cloud/ipfs/');
                nfts.push({ id: i, tokenURI, imageUri, price: metadata.price, owner });
                if ( owner=== signerAddress){
                    userNFTs.push({ id: i, tokenURI, imageUri, price: metadata.price, owner });
                }
            }
            console.log('Minted NFTs:', nfts); // Debugging log
            setMintedNFTs(nfts);
        } catch (error) {
            console.error('Error fetching minted NFTs:', error);
            setError('Error fetching minted NFTs');
        }
    };

    const buyNFT = async (tokenId, ownerAddress, nftPrice) => {
        try {
            if (!signer || !nftContract) {
                setError('Signer or NFT contract not initialized.');
                return;
            }
    
            if (ownerAddress.toLowerCase() === signerAddress.toLowerCase()) {
                window.alert('You cannot buy your own NFT.');
                return;
            }
    
            if (!nftPrice || isNaN(nftPrice) || Number(nftPrice) <= 0) {
                setError('Invalid price value.');
                return;
            }
    
            const confirmed = window.confirm(`Are you sure you want to buy this NFT from ${ownerAddress}?`);
            if (!confirmed) {
                return;
            }
    
            // Send transaction to buy the NFT
            const tx = await signer.sendTransaction({
                to: ownerAddress,
                value: ethers.utils.parseEther(nftPrice),
            });
    
            await tx.wait();
            console.log(`Purchased NFT ${tokenId} from ${ownerAddress}`);
    
         
            const transferTx = await nftContract.transferFrom(ownerAddress, signerAddress, tokenId);
            await transferTx.wait();
            await nftContract._removeNFTFromUser(signerAddress, tokenId);
    
            // Update the minted NFTs list by filtering out the bought NFT
            const updatedMintedNFTs = mintedNFTs.filter(nft => nft.id !== tokenId);
            setMintedNFTs(updatedMintedNFTs);
    
            
            const buyerNFTs = await nftContract.userNFTs(signerAddress);
            const newUserNFT = { id: tokenId, tokenURI: `ipfs://${tokenId}`, imageUri: `https://gateway.pinata.cloud/ipfs/${tokenId}`, price: nftPrice, owner: signerAddress };
            setUserNFTs([...buyerNFTs, newUserNFT]);
    
            console.log(`Ownership of NFT ${tokenId} successfully transferred to ${signerAddress}`);
            setError('');
        } catch (error) {
            console.error('Error purchasing NFT:', error);
            setError(`Error purchasing NFT`);
        }
    };
    
    const toggleTab = (tab) => {
        setActiveTab(tab);
    };

    return (
        <div className="container">
            <div className="header">
                <div className="top-section">
                    <h1>PICARTS</h1>
                    <div className="connect-button-container">
                        {!isConnected ? (
                            <button onClick={connectToMetaMask} className="connect-button">Connect to MetaMask</button>
                        ) : (
                            <p>Connected as {signerAddress}</p>
                        )}
                    </div>
                </div>
                <div className="tabs">
                    <button
                        className={activeTab === 'mint' ? 'active-tab' : ''}
                        onClick={() => toggleTab('mint')}
                    >
                        Mint
                    </button>
                    <button
                        className={activeTab === 'mintedNFTs' ? 'active-tab' : ''}
                        onClick={() => toggleTab('mintedNFTs')}
                    >
                        NFT MARKETPLACE
                    </button>
                    <button
                        className={activeTab === 'myNFTs' ? 'active-tab' : ''}
                        onClick={() => toggleTab('myNFTs')}
                    >
                        My NFTs
                    </button>
                </div>
            </div>

            <div className="content">
                {activeTab === 'mint' && (
                    <div className="mint-section">
                        <h2>Mint NFT</h2>
                        <input type="file" onChange={(e) => setSelectedFile(e.target.files[0])} />
                        <input
                            type="number"
                            value={price}
                            onChange={(e) => setPrice(e.target.value)}
                            placeholder="Enter Price in Ether"
                        />
                         
                        <button onClick={() => mintNFT(price)} className="mint-button">Mint</button>
                        {error && <p style={{ color: 'red' }}>{error}</p>}
                    </div>
                )}

                {activeTab === 'myNFTs' && (
                    <div className="user-nfts">
                        {userNFTs.length > 0 ? (
                            userNFTs.map((nft, index) => (
                                <div key={index} className="user-nft">
                                    <img src={nft.imageUri} alt={`Token ${nft.id}`} />
                                    <p>Owner: {nft.owner}</p>
                                    <p>Price: {nft.price} ETH</p>
                                </div>
                            ))
                        ) : (
                            <p>You don't own any NFTs yet.</p>
                        )}
                    </div>
                )}

                {activeTab === 'mintedNFTs' && (
                    <div className="minted-nfts">
                        {mintedNFTs.length > 0 ? (
                            mintedNFTs.map((nft, index) => (
                                <div key={index} className="minted-nft">
                                    <img src={nft.imageUri} alt={`Token ${nft.id}`} />
                                    <p>Owner: {nft.owner}</p>
                                    <p>Price: {nft.price} ETH</p>
                                    <button onClick={() => buyNFT(nft.id, nft.owner, nft.price)} className="buy-button">Buy</button>
                                </div>
                            ))
                        ) : (
                            <p>No minted NFTs available.</p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default NFTImageFetcher;
