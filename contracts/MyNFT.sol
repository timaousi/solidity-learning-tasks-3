// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MyNFT is ERC721, Ownable {
    uint256 private _tokenIdCounter;
    mapping(uint256 => string) private _tokenURIs;

    constructor() ERC721("MyAuctionNFT", "MAUCN") Ownable(msg.sender) {
        _tokenIdCounter = 0;
    }

    /// @notice 仅限所有者铸造 NFT，并指定元数据 URI。
    function mint(address to, string memory fullTokenURI) public onlyOwner returns (uint256) {
        require(to != address(0), unicode"NFT: 接收地址不能为零地址");

        uint256 newTokenId = _tokenIdCounter;
        _safeMint(to, newTokenId);
        _setTokenURI(newTokenId, fullTokenURI);

        _tokenIdCounter += 1;
        return newTokenId;
    }

    /// @notice 内部函数：设置特定 tokenId 的元数据 URI。
    function _setTokenURI(uint256 tokenId, string memory _tokenURI) internal virtual {
        require(_ownerOf(tokenId) != address(0), unicode"NFT: 设置URI的代币不存在");
        _tokenURIs[tokenId] = _tokenURI;
    }

    /// @notice 返回特定 NFT 的元数据 URI。
    /// @dev 此函数符合 ERC721 标准，不要求调用者是代币所有者。
    function tokenURI(uint256 tokenId) public view virtual override returns (string memory) {
        require(_ownerOf(tokenId) != address(0), unicode"ERC721Metadata: 查询不存在的代币URI");

        string memory customURI = _tokenURIs[tokenId];
        if (bytes(customURI).length > 0) {
            return customURI;
        }
        return "";
    }
}