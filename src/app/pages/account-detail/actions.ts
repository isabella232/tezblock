import { createAction, props } from '@ngrx/store';

import { Transaction } from '@tezblock/interfaces/Transaction';
import { Account } from '@tezblock/domain/account';
import { GetDelegatedAccountsResponseDto } from '@tezblock/services/account/account.service';
import { Balance } from '@tezblock/services/api/api.service';
import { Count } from '@tezblock/domain/tab';
import { OrderBy } from '@tezblock/services/base.service';
import { OperationErrorsById } from '@tezblock/domain/operations';
import { BakingRatingResponse, ContractAsset } from './model';
import { TezosPayoutInfo } from '@airgap/coinlib-core';

const featureName = 'Account Detail';

export const loadRewardAmont = createAction(
  `[${featureName}] Load Reward Amont`,
  props<{ accountAddress: string; bakerAddress: string }>()
);
export const loadRewardAmontSucceeded = createAction(
  `[${featureName}] Load Reward Amont Succeeded`,
  props<{ rewardAmount: string }>()
);
export const loadRewardAmontFailed = createAction(
  `[${featureName}] Load Reward Amont Failed`,
  props<{ error: any }>()
);

export const loadTransactionsByKind = createAction(
  `[${featureName}] Load Transactions By Kind`,
  props<{ kind: string; orderBy?: OrderBy }>()
);
export const loadTransactionsByKindSucceeded = createAction(
  `[${featureName}] Load Transactions By Kind Succeeded`,
  props<{ data: Transaction[] }>()
);
export const loadTransactionsByKindFailed = createAction(
  `[${featureName}] Load Transactions By Kind Failed`,
  props<{ error: any }>()
);

export const loadTransactionsCounts = createAction(
  `[${featureName}] Load Transactions Counts`
);
export const loadTransactionsCountsSucceeded = createAction(
  `[${featureName}] Load Transactions Counts Succeeded`,
  props<{ counts: Count[] }>()
);
export const loadTransactionsCountsFailed = createAction(
  `[${featureName}] Load Transactions Counts Failed`,
  props<{ error: any }>()
);

export const loadAccount = createAction(
  `[${featureName}] Load Account`,
  props<{ address: string }>()
);
export const loadAccountSucceeded = createAction(
  `[${featureName}] Load Account Succeeded`,
  props<{ account: Account }>()
);
export const loadAccountFailed = createAction(
  `[${featureName}] Load Account Failed`,
  props<{ error: any }>()
);

export const loadDelegation = createAction(
  `[${featureName}] Refresh Delegation`
);
export const loadDelegatedAccountsSucceeded = createAction(
  `[${featureName}] Load Delegated Accounts Succeeded`,
  props<{ accounts: GetDelegatedAccountsResponseDto }>()
);
export const loadDelegatedAccountsFailed = createAction(
  `[${featureName}] Load Delegated Accounts Failed`,
  props<{ error: any }>()
);

export const loadCollectibles = createAction(
  `[${featureName}] Load Collectibles`
);
export const loadCollectiblesSucceeded = createAction(
  `[${featureName}] Load Collectibles Succeeded`,
  props<{ data: any }>()
);
export const loadCollectiblesFailed = createAction(
  `[${featureName}] Load Collectibles Failed`,
  props<{ error: any }>()
);

export const loadCollectiblesCount = createAction(
  `[${featureName}] Load Collectibles Count`
);
export const loadCollectiblesCountSucceeded = createAction(
  `[${featureName}] Load Collectibles Count Succeeded`,
  props<{ data: number }>()
);
export const loadCollectiblesCountFailed = createAction(
  `[${featureName}] Load Collectibles Count Failed`,
  props<{ error: any }>()
);

export const loadBalanceForLast30Days = createAction(
  `[${featureName}] Load Balance For Last 30 Days`,
  props<{ address: string }>()
);
export const loadBalanceForLast30DaysSucceeded = createAction(
  `[${featureName}] Load Balance For Last 30 Days Succeeded`,
  props<{ balanceFromLast30Days: Balance[] }>()
);
export const loadBalanceForLast30DaysFailed = createAction(
  `[${featureName}] Load Balance For Last 30 Days Failed`,
  props<{ error: any }>()
);

export const loadExtraBalance = createAction(
  `[${featureName}] Load Extra Balance`,
  props<{ temporaryBalance: Balance[] }>()
);
export const loadExtraBalanceSucceeded = createAction(
  `[${featureName}] Load Extra Balance Succeeded`,
  props<{ extraBalance: Balance[] }>()
);
export const loadExtraBalanceFailed = createAction(
  `[${featureName}] Load Extra Balance Failed`,
  props<{ error: any }>()
);

export const loadBakingBadRatings = createAction(
  `[${featureName}] Load Baking Bad Ratings`,
  props<{ address: string }>()
);
export const loadBakingBadRatingsSucceeded = createAction(
  `[${featureName}] Load Baking Bad Ratings Succeeded`,
  props<{ response: BakingRatingResponse }>()
);
export const loadBakingBadRatingsFailed = createAction(
  `[${featureName}] Load Baking Bad Ratings Failed`,
  props<{ error: any }>()
);

export const sortTransactionsByKind = createAction(
  `[${featureName}] Sort Transactions`,
  props<{ orderBy: OrderBy }>()
);

export const increasePageSize = createAction(
  `[${featureName}] Change Page Size`
);

export const loadTransactionsErrors = createAction(
  `[${featureName}] Load Transactions Errors`,
  props<{ transactions: Transaction[] }>()
);
export const loadTransactionsErrorsSucceeded = createAction(
  `[${featureName}] Load Transactions Errors Succeeded`,
  props<{ operationErrorsById: OperationErrorsById[] }>()
);
export const loadTransactionsErrorsFailed = createAction(
  `[${featureName}] Load Transactions Errors Failed`,
  props<{ error: any }>()
);

export const loadBakerReward = createAction(
  `[${featureName}] Load Baker Reward`,
  props<{ bakerAddress: string }>()
);
export const loadBakerRewardSucceeded = createAction(
  `[${featureName}] Load Baker Reward Succeeded`,
  props<{ bakerReward: TezosPayoutInfo }>()
);
export const loadBakerRewardFailed = createAction(
  `[${featureName}] Load Baker Reward Failed`,
  props<{ error: any }>()
);

export const loadContractAssets = createAction(
  `[${featureName}] Load Contract Assets`
);
export const loadContractAssetsSucceeded = createAction(
  `[${featureName}] Load Contract Assets Succeeded`,
  props<{ data: ContractAsset[] }>()
);
export const loadContractAssetsFailed = createAction(
  `[${featureName}] Load Contract Assets Failed`,
  props<{ error: any }>()
);

export const loadStakingCapacityFromTezosProtocol = createAction(
  `[${featureName}] Load Staking Capacity From TezosProtocol`
);
export const loadStakingCapacityFromTezosProtocolSucceeded = createAction(
  `[${featureName}] Load Staking Capacity From TezosProtocol Succeeded`,
  props<{ stakingCapacity: number }>()
);
export const loadStakingCapacityFromTezosProtocolFailed = createAction(
  `[${featureName}] Load Staking Capacity From TezosProtocol Failed`,
  props<{ error: any }>()
);

export const setKind = createAction(
  `[${featureName}] Set Kind`,
  props<{ kind: string }>()
);

export const reset = createAction(`[${featureName}] Reset`);
