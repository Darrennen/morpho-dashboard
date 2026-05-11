export interface MorphoPosition {
  market: {
    uniqueKey: string;
    lltv: string;
    collateralAsset: { symbol: string; decimals: number; priceUsd: number } | null;
    loanAsset: { symbol: string; decimals: number; priceUsd: number };
    state: { borrowApy: number; supplyApy: number } | null;
  };
  borrowAssets: string;
  borrowAssetsUsd: number;
  collateral: string;
  collateralUsd: number;
  healthFactor: number | null;
  supplyAssets: string;
  supplyAssetsUsd: number;
}

export interface ParsedPosition {
  marketKey: string;
  collateralSymbol: string;
  loanSymbol: string;
  collateralAmount: number;
  collateralUsd: number;
  borrowedAmount: number;
  borrowedUsd: number;
  suppliedAmount: number;
  suppliedUsd: number;
  healthFactor: number | null;
  lltv: number;
  ltv: number;
  borrowApy: number;
  supplyApy: number;
  collateralDecimals: number;
  loanDecimals: number;
  // Derived risk/cost metrics
  collateralPriceUsd: number;
  liquidationPriceUsd: number | null;
  dropToLiquidationPct: number | null;
  dailyBorrowCostUsd: number;
  monthlyBorrowCostUsd: number;
  annualBorrowCostUsd: number;
}

export function parsePosition(pos: MorphoPosition): ParsedPosition {
  const lltv = Number(pos.market.lltv) / 1e18;
  const collateralDecimals = pos.market.collateralAsset?.decimals ?? 18;
  const loanDecimals = pos.market.loanAsset.decimals;

  const collateralAmount = Number(pos.collateral) / 10 ** collateralDecimals;
  const borrowedAmount = Number(pos.borrowAssets) / 10 ** loanDecimals;
  const suppliedAmount = Number(pos.supplyAssets) / 10 ** loanDecimals;

  const borrowedUsd = pos.borrowAssetsUsd ?? 0;
  const collateralUsd = pos.collateralUsd ?? 0;

  const ltv =
    collateralUsd > 0 && borrowedUsd > 0
      ? (borrowedUsd / collateralUsd) * 100
      : 0;

  // Current collateral price per token
  const collateralPriceUsd =
    collateralAmount > 0 ? collateralUsd / collateralAmount : (pos.market.collateralAsset?.priceUsd ?? 0);

  // Liquidation price: the collateral price/token at which HF = 1
  // HF = (collateralAmount * price * lltv) / borrowedUsd = 1
  // => price = borrowedUsd / (collateralAmount * lltv)
  const liquidationPriceUsd =
    borrowedUsd > 0 && collateralAmount > 0 && lltv > 0
      ? borrowedUsd / (collateralAmount * lltv)
      : null;

  // How far collateral price can drop before liquidation
  const dropToLiquidationPct =
    liquidationPriceUsd !== null && collateralPriceUsd > 0
      ? ((collateralPriceUsd - liquidationPriceUsd) / collateralPriceUsd) * 100
      : null;

  const borrowApy = (pos.market.state?.borrowApy ?? 0) * 100;
  const dailyBorrowCostUsd = borrowedUsd * (borrowApy / 100) / 365;
  const monthlyBorrowCostUsd = dailyBorrowCostUsd * 30;
  const annualBorrowCostUsd = borrowedUsd * (borrowApy / 100);

  return {
    marketKey: pos.market.uniqueKey,
    collateralSymbol: pos.market.collateralAsset?.symbol ?? "—",
    loanSymbol: pos.market.loanAsset.symbol,
    collateralAmount,
    collateralUsd,
    borrowedAmount,
    borrowedUsd,
    suppliedAmount,
    suppliedUsd: pos.supplyAssetsUsd ?? 0,
    healthFactor: pos.healthFactor,
    lltv,
    ltv,
    borrowApy,
    supplyApy: (pos.market.state?.supplyApy ?? 0) * 100,
    collateralDecimals,
    loanDecimals,
    collateralPriceUsd,
    liquidationPriceUsd,
    dropToLiquidationPct,
    dailyBorrowCostUsd,
    monthlyBorrowCostUsd,
    annualBorrowCostUsd,
  };
}

export const MORPHO_API = "https://blue-api.morpho.org/graphql";

export const POSITIONS_QUERY = `
  query UserPositions($address: String!, $chainId: Int!) {
    userByAddress(address: $address, chainId: $chainId) {
      marketPositions {
        market {
          uniqueKey
          lltv
          collateralAsset { symbol decimals priceUsd }
          loanAsset { symbol decimals priceUsd }
          state { borrowApy supplyApy }
        }
        borrowAssets
        borrowAssetsUsd
        collateral
        collateralUsd
        healthFactor
        supplyAssets
        supplyAssetsUsd
      }
    }
  }
`;
