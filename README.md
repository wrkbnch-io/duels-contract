# Duels contract

This smart contract enables two players to compete against each other using ERC20 tokens. The constructor lets owner specify the token and minimum bet amount during deployment.

## Contract Logic

### Game Creation

- The player who initiates a game is referred to as the **host**.
- The host can bet any amount of tokens, as long as it is above the minimum bet limit.

### Game Participation

- The player who joins an existing game is referred to as the **guest**.
- The guest’s bet must be within a specific range based on the host’s bet:

  - **Lower bound**: 30% less than the host’s bet (but not below the minimum allowed bet).

  - **Upper bound**: 30% more than the host’s bet.

- The guest’s bet amount influences their probability of winning:

  - Betting **30% more** than the host increases the guest’s chance of winning by **10%**.

### Game Resolution & Withdrawals

- Once the game concludes, the **winner** may call the `withdraw()` function to claim their funds.

  - The contract owner takes a **10% fee** from the total pool.

  - Pool = Host’s bet + Guest’s bet.

- If a game remains unjoined for **12 hours**, its status changes to `Expired`, making it ineligible for participation.

  - The owner must then invoke the `expire()` function to refund the host’s initial bet from the pool.

## Development Commands

```shell
bunx hardhat node --network hardhat
bunx hardhat test --network hardhat
```
