// SPDX-License-Identifier: MIT
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("MockV3Aggregator Contract", function () {
    let MockV3Aggregator, priceFeed;
    let owner;

    beforeEach(async function () {
        [owner] = await ethers.getSigners();
        MockV3Aggregator = await ethers.getContractFactory("MockV3Aggregator");
        priceFeed = await MockV3Aggregator.deploy(8, 2000 * 1e8);
        await priceFeed.waitForDeployment();
    });

    it("应返回正确的小数位数和描述", async function () {
        expect(await priceFeed.decimals()).to.equal(8);
        expect(await priceFeed.description()).to.equal("模拟 ETH / USD 价格数据流");
        expect(await priceFeed.version()).to.equal(1);
    });

    it("应返回正确的最新轮次数据", async function () {
        const { roundId, answer, startedAt, updatedAt, answeredInRound } = await priceFeed.latestRoundData();
        expect(roundId).to.equal(1);
        expect(answer).to.equal(2000 * 1e8);
        expect(startedAt).to.equal(await ethers.provider.getBlock("latest").then(block => block.timestamp));
        expect(updatedAt).to.equal(await ethers.provider.getBlock("latest").then(block => block.timestamp));
        expect(answeredInRound).to.equal(1); // 覆盖行 101
    });

    it("应正确返回轮次数据", async function () {
        const { roundId, answer, startedAt, updatedAt, answeredInRound } = await priceFeed.getRoundData(1);
        expect(roundId).to.equal(1);
        expect(answer).to.equal(2000 * 1e8);
        expect(startedAt).to.equal(await ethers.provider.getBlock("latest").then(block => block.timestamp));
        expect(updatedAt).to.equal(await ethers.provider.getBlock("latest").then(block => block.timestamp));
        expect(answeredInRound).to.equal(1); // 覆盖行 91-93
    });

    it("应正确更新价格并反映在最新轮次数据中", async function () {
        await priceFeed.updateAnswer(3000 * 1e8);
        const { roundId, answer, startedAt, updatedAt, answeredInRound } = await priceFeed.latestRoundData();
        expect(answer).to.equal(3000 * 1e8);
        expect(roundId).to.equal(1);
        expect(startedAt).to.equal(await ethers.provider.getBlock("latest").then(block => block.timestamp));
        expect(updatedAt).to.equal(await ethers.provider.getBlock("latest").then(block => block.timestamp));
        expect(answeredInRound).to.equal(1); // 覆盖行 101
    });

    it("应正确返回不同轮次数据", async function () {
        await priceFeed.updateAnswer(3000 * 1e8);
        const { roundId, answer } = await priceFeed.getRoundData(2);
        expect(roundId).to.equal(2);
        expect(answer).to.equal(3000 * 1e8); // 覆盖行 91-93
    });
});