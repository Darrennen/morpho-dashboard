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
    borrowApy: (pos.market.state?.borrowApy ?? 0) * 100,
    supplyApy: (pos.market.state?.supplyApy ?? 0) * 100,
    collateralDecimals,
    loanDecimals,
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
