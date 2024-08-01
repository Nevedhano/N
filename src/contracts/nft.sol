// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Burnable.sol";

contract MyToken is ERC721, ERC721URIStorage {
    uint256 public _nextTokenId;
    mapping(address => uint256[]) private user_NFTs;
 

    constructor() ERC721("MyToken", "MTK") {
        _nextTokenId = 1;
    }

    function safeMint(string memory uri) public {
        uint256 tokenId = _nextTokenId;
        user_NFTs[msg.sender].push(tokenId);
        _nextTokenId++;
        _safeMint(msg.sender, tokenId);
        _setTokenURI(tokenId, uri);
    }

    function tokenCounter() public view returns (uint256) {
        return _nextTokenId - 1;
    }
    
    function userNFTs(address user) public view returns (uint256[] memory) {
        return user_NFTs[user];
    }


   function _removeNFTFromUser(address user, uint256 tokenId) public {
        uint256 length = user_NFTs[user].length;
        for (uint256 i = 1; i <= length; i++) {
            if (user_NFTs[user][i] == tokenId) {
               user_NFTs[user][length] =user_NFTs[user][i];
                user_NFTs[user].pop();
                break;
            }
        }
    }

    function tokenURI(uint256 tokenId) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721, ERC721URIStorage) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
