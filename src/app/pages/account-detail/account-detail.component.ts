import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import {
  animate,
  state,
  style,
  transition,
  trigger,
} from '@angular/animations';
import { ActivatedRoute } from '@angular/router';
import { BsModalService } from 'ngx-bootstrap/modal';
import { ToastrService } from 'ngx-toastr';
import { BehaviorSubject, Observable, combineLatest } from 'rxjs';
import {
  delay,
  distinctUntilChanged,
  map,
  filter,
  withLatestFrom,
  switchMap,
  take,
} from 'rxjs/operators';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { Store } from '@ngrx/store';
import { negate, isNil, isNumber, range, uniqBy } from 'lodash';
import { Actions, ofType } from '@ngrx/effects';
import { ChartOptions } from 'chart.js';
import { FormControl } from '@angular/forms';
import { TypeaheadMatch } from 'ngx-bootstrap/typeahead';
import { BeaconBaseMessage, OperationResponseOutput } from '@airgap/beacon-sdk';

import { TelegramModalComponent } from '@tezblock/components/telegram-modal/telegram-modal.component';
import { QrModalComponent } from '@tezblock/components/qr-modal/qr-modal.component';
import { Tab, updateTabCounts } from '@tezblock/domain/tab';
import {
  Account,
  JsonAccount,
  JsonAccountData,
  getBakers,
  doesAcceptsDelegations,
} from '@tezblock/domain/account';
import { AliasPipe } from '@tezblock/pipes/alias/alias.pipe';
import { AccountService } from '@tezblock/services/account/account.service';
import { BakingService } from '@tezblock/services/baking/baking.service';
import { CopyService } from '@tezblock/services/copy/copy.service';
import { CurrencyInfo } from '@tezblock/services/crypto-prices/crypto-prices.service';
import { IconPipe } from '@tezblock/pipes/icon/icon.pipe';
import { ChainNetworkService } from '@tezblock/services/chain-network/chain-network.service';
import { BaseComponent } from '@tezblock/components/base.component';
import * as fromRoot from '@tezblock/reducers';
import * as actions from './actions';
import { Busy, BakerTableRatings } from './reducer';
import { OperationTypes } from '@tezblock/domain/operations';
import { columns } from './table-definitions';
import { getRefresh } from '@tezblock/domain/synchronization';
import { OrderBy } from '@tezblock/services/base.service';
import { TranslateService } from '@ngx-translate/core';
import { Title, Meta } from '@angular/platform-browser';
import { AliasService } from '@tezblock/services/alias/alias.service';
import { ContractAsset } from './model';
import { isInBTC } from '@tezblock/domain/airgap';
import * as appActions from '@tezblock/app.actions';
import { getPrecision } from '@tezblock/components/tezblock-table/amount-cell/amount-cell.component';
import { first, get } from '@tezblock/services/fp';
import { TabbedTableComponent } from '@tezblock/components/tabbed-table/tabbed-table.component';
import { getRewardAmountMinusFee } from '@tezblock/domain/reward';
import { BeaconService } from '@tezblock/services/beacon/beacon.service';
import { Asset } from '@tezblock/components/assets-value/assets-value.component';
import { jsonAccounts } from '@tezblock/domain/account';
import { TezosNetwork } from '@airgap/coinlib-core';

interface RightsPerBlockLevel {
  isInFuture: number;
  from: number;
  to: number;
  endorsements: number;
  bakes: number;
}

@Component({
  selector: 'app-account-detail',
  templateUrl: './account-detail.component.html',
  styleUrls: ['./account-detail.component.scss'],
  animations: [
    trigger('changeBtnColor', [
      state(
        'copyTick',
        style({
          backgroundColor: 'lightgreen',
          backgroundImage: '',
        })
      ),
      transition('copyGrey =>copyTick', [
        animate(
          250,
          style({
            transform: 'rotateY(360deg) scale(1.3)',
            backgroundColor: 'lightgreen',
          })
        ),
      ]),
    ]),
    trigger('AnimateList', [
      transition('void => *', [
        style({ opacity: 0, transform: 'translateY(-75%)' }),
        animate('0.3s 6ms ease-in'),
      ]),

      transition('* => void', [
        animate(
          '0.2s ease-out',
          style({ opacity: 0.01, transform: 'translateY(-75%)' })
        ),
      ]),
    ]),
  ],
})
export class AccountDetailComponent extends BaseComponent implements OnInit {
  account$: Observable<Account>;
  delegatedAccountAddress: string | undefined;
  relatedAccounts$: Observable<Account[]>;
  delegatedAmount: number | undefined;

  set bakerAddress(value: string | undefined) {
    if (value !== this._bakerAddress) {
      this._bakerAddress = value;
    }
  }
  get bakerAddress(): string | undefined {
    return this._bakerAddress;
  }
  private _bakerAddress: string | undefined;

  @ViewChild('transactions') transactions: ElementRef;

  bakerTableInfos: any;
  bakerTableRatings$: Observable<BakerTableRatings>;
  tezosBakerFee$: Observable<number>;
  tezosBakerFeeLabel$: Observable<string | undefined>;

  revealed$: Observable<string>;
  hasAlias: boolean | undefined;
  hasLogo: boolean | undefined;

  fiatCurrencyInfo$: Observable<CurrencyInfo>;

  paginationLimit = 2;
  numberOfInitialRelatedAccounts = 2;

  isCollapsed: boolean = true;

  current: string = 'copyGrey';

  tabs: Tab[];
  bakerTabs: Tab[];

  rewardAmount$: Observable<string>;
  rewardAmountMinusFee$: Observable<number>;
  isRewardAmountMinusFeeBusy$: Observable<boolean>;
  remainingTime$: Observable<string>;

  get address(): string {
    return this.activatedRoute.snapshot.params.id;
  }

  isMobile$: Observable<boolean>;
  isBusy$: Observable<Busy>;
  transactions$: Observable<any[]>;
  areTransactionsLoading$: Observable<boolean>;
  balanceChartDatasets$: Observable<{ data: number[]; label: string }[]>;
  balanceChartLabels$: Observable<string[]>;
  orderBy$: Observable<OrderBy>;
  contractAssets$: Observable<ContractAsset[]>;
  assets$: Observable<Asset[]>;
  numberOfContractAssets$: Observable<number>;
  getPrecision = getPrecision;
  isExchange: boolean;
  delegationControl: FormControl;
  delegationControlDataSource$: BehaviorSubject<string[]>;
  selectedDelegation: string;
  rightsPerBlockLevel$: Observable<RightsPerBlockLevel[]>;
  rightsPerBlockLevelBusy$: Observable<RightsPerBlockLevel[]>;
  rightsPerBlockLevelTooltipContext: RightsPerBlockLevel;
  areBusyRightsPerBlockLevel$: Observable<boolean>;

  get isMainnet(): boolean {
    return this.chainNetworkService.getNetwork() === TezosNetwork.MAINNET;
  }

  private rewardAmountSetFor: { account: string; baker: string } = {
    account: undefined,
    baker: undefined,
  };
  private scrolledToTransactions = false;
  @ViewChild(TabbedTableComponent)
  private tabbedTableComponent: TabbedTableComponent;

  balanceChartOptions: ChartOptions = {
    responsive: true,
    layout: {
      padding: {
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
      },
    },
    animation: {
      duration: 1250, // general animation time
    },
    hover: {
      animationDuration: 250, // duration of animations when hovering an item
      intersect: false,
      mode: 'x-axis',
    },
    responsiveAnimationDuration: 0, // animation duration after a resize
    legend: {
      display: false,
    },
    scales: {
      yAxes: [
        {
          display: false,
          gridLines: {
            display: false,
          },
        },
      ],
      xAxes: [
        {
          display: false,
          gridLines: {
            display: false,
          },
        },
      ],
    },
    elements: {
      point: {
        radius: 1,
      },
      line: {
        tension: 0, // disables bezier curves
      },
    },

    tooltips: {
      mode: 'x-axis',
      intersect: false,
      displayColors: false, // removes color box and label

      callbacks: {
        title: function (data) {
          if (data[0].label.includes(':')) {
            return data[0].label.slice(0, -3);
          } else {
            return data[0].label;
          }
        },
        label: function (data, labels): string {
          if (Number(data.value) % 1 !== 0) {
            let value = parseFloat(data.value).toFixed(2);
            if (labels.datasets[0].label === 'Balance') {
              return value + ' ꜩ';
            } else {
              return '$' + value;
            }
          } else {
            return data.value;
          }
        },
      },
    },
    spanGaps: true,
  };

  constructor(
    private readonly actions$: Actions,
    readonly chainNetworkService: ChainNetworkService,
    private readonly activatedRoute: ActivatedRoute,
    private readonly accountService: AccountService,
    private readonly bakingService: BakingService,
    private readonly beaconService: BeaconService,
    private readonly modalService: BsModalService,
    private readonly copyService: CopyService,
    private readonly aliasPipe: AliasPipe,
    private readonly toastrService: ToastrService,
    private readonly iconPipe: IconPipe,
    private readonly breakpointObserver: BreakpointObserver,
    private readonly store$: Store<fromRoot.State>,
    private translateService: TranslateService,
    private titleService: Title,
    private metaTagService: Meta,
    private aliasService: AliasService
  ) {
    super();
    this.store$.dispatch(actions.reset());
  }

  async ngOnInit() {
    this.setupDelegation();
    this.fiatCurrencyInfo$ = this.store$.select(
      (state) => state.app.fiatCurrencyInfo
    );
    this.relatedAccounts$ = this.store$.select(
      (state) => state.accountDetails.relatedAccounts
    );
    this.account$ = this.store$.select((state) => state.accountDetails.account);
    this.isMobile$ = this.breakpointObserver
      .observe([Breakpoints.Handset, Breakpoints.Small])
      .pipe(map((breakpointState) => breakpointState.matches));
    this.bakerTableRatings$ = this.store$.select(
      (state) => state.accountDetails.bakerTableRatings
    );
    this.tezosBakerFee$ = this.store$.select(
      (state) => state.accountDetails.tezosBakerFee
    );
    this.rewardAmount$ = this.store$.select(
      (state) => state.accountDetails.rewardAmount
    );
    this.rewardAmountMinusFee$ = this.account$.pipe(
      filter(negate(isNil)),
      switchMap((account) =>
        account.is_baker
          ? this.store$
              .select((state) => state.accountDetails.bakerReward)
              .pipe(
                map((reward) =>
                  reward
                    ? parseFloat(reward.payout)
                    : reward === undefined
                    ? undefined
                    : null
                )
              )
          : combineLatest([
              this.rewardAmount$.pipe(map(parseFloat)),
              this.tezosBakerFee$,
            ]).pipe(
              map(([rewardAmount, tezosBakerFee]) =>
                rewardAmount && tezosBakerFee
                  ? getRewardAmountMinusFee(rewardAmount, tezosBakerFee)
                  : null
              )
            )
      )
    );

    this.isRewardAmountMinusFeeBusy$ = this.account$.pipe(
      filter(negate(isNil)),
      switchMap((account) =>
        account.is_baker
          ? this.store$.select((state) => state.accountDetails.busy.bakerReward)
          : combineLatest([
              this.store$.select(
                (state) => state.accountDetails.busy.rewardAmount
              ),
              this.store$.select((state) => state.accountDetails.rewardAmount),
              this.tezosBakerFee$,
            ]).pipe(
              map(
                ([isRewardAmontBusy, rewardAmount, tezosBakerFee]) =>
                  !(rewardAmount === null) &&
                  (isRewardAmontBusy || tezosBakerFee === undefined)
              )
            )
      )
    );
    this.isBusy$ = this.store$.select((state) => state.accountDetails.busy);
    this.remainingTime$ = this.store$.select(fromRoot.app.roundedRemainingTime);
    this.transactions$ = this.store$
      .select((state) => state.accountDetails.kind)
      .pipe(
        switchMap((kind) => {
          switch (kind) {
            case 'assets':
              return this.store$.select(
                (state) => state.accountDetails.contractAssets.data
              );
            case 'collectibles':
              return this.store$.select(
                (state) => state.accountDetails.collectibles.data
              );

            default:
              return this.store$.select(
                (state) => state.accountDetails.transactions.data
              );
              break;
          }
        })
      );

    this.areTransactionsLoading$ = this.store$
      .select((state) => state.accountDetails.kind)
      .pipe(
        switchMap((kind) =>
          kind !== 'assets'
            ? this.store$.select(
                (state) => state.accountDetails.transactions.loading
              )
            : this.store$.select(
                (state) => state.accountDetails.contractAssets.loading
              )
        )
      );
    this.tezosBakerFeeLabel$ = this.tezosBakerFee$.pipe(
      map((tezosBakerFee) =>
        isNumber(tezosBakerFee)
          ? tezosBakerFee + ' %'
          : tezosBakerFee === null
          ? 'not available'
          : undefined
      )
    );
    this.balanceChartDatasets$ = this.store$
      .select((state) => state.accountDetails.balanceFromLast30Days)
      .pipe(
        filter(Array.isArray),
        map((data) => [
          { data: data.map((dataItem) => dataItem.balance), label: 'Balance' },
        ])
      );
    this.balanceChartLabels$ = this.store$
      .select((state) => state.accountDetails.balanceFromLast30Days)
      .pipe(
        filter(Array.isArray),
        map((data) =>
          data.map((dataItem) => new Date(dataItem.asof).toDateString())
        )
      );
    this.orderBy$ = this.store$.select(
      (state) => state.accountDetails.transactions.orderBy
    );
    this.contractAssets$ = this.store$
      .select((state) => state.accountDetails.contractAssets.data)
      .pipe(
        distinctUntilChanged(),
        map((contractAssets) => contractAssets || [])
      );
    this.assets$ = this.contractAssets$.pipe(
      filter(Array.isArray),
      map((contractAssets) =>
        contractAssets.map((contractAsset: ContractAsset) => ({
          value: contractAsset.amount,
          symbol: contractAsset.contract.symbol,
        }))
      )
    );
    this.numberOfContractAssets$ = this.contractAssets$.pipe(
      map(
        (contractAssets: ContractAsset[]) =>
          uniqBy(contractAssets, (contractAsset) => contractAsset.contract.name)
            .length
      )
    );
    this.areBusyRightsPerBlockLevel$ = combineLatest([
      this.store$.select((state) => state.bakerTable.bakingRights.loading),
      this.store$.select((state) => state.bakerTable.endorsingRights.loading),
    ]).pipe(
      map(
        ([bakingRightsLoading, endorsingRightsLoading]) =>
          bakingRightsLoading || endorsingRightsLoading
      )
    );
    this.rightsPerBlockLevel$ = combineLatest([
      this.store$.select((state) => state.app.latestBlock),
      this.store$.select((state) => state.app.firstBlockOfCurrentCycle),
      this.store$.select((state) => state.app.protocolVariables),
      this.store$.select((state) => state.bakerTable.bakingRights.data),
      this.store$.select((state) => state.bakerTable.endorsingRights.data),
    ]).pipe(
      filter(
        ([
          latestBlock,
          firstBlockOfCurrentCycle,
          protocolVariables,
          bakingRights,
          endorsingRights,
        ]) =>
          latestBlock &&
          firstBlockOfCurrentCycle &&
          protocolVariables &&
          bakingRights !== undefined &&
          endorsingRights !== undefined
      ),
      map(
        ([
          latestBlock,
          firstBlockOfCurrentCycle,
          protocolVariables,
          bakingRights,
          endorsingRights,
        ]) => {
          /*
          looks like bakingRewardsDetails/endorsingRewardsDetails property contains data for unique level(s)
          so grouping no needed
        */
          const step = 6;
          const bakingRightsFromCurrentCycle = bakingRights.find(
            (right) => right.cycle === firstBlockOfCurrentCycle.meta_cycle
          );
          const endorsingRightsFromCurrentCycle = endorsingRights.find(
            (right) => right.cycle === firstBlockOfCurrentCycle.meta_cycle
          );
          const lastBlockLevelInCycle =
            firstBlockOfCurrentCycle.level +
            protocolVariables.blocks_per_cycle -
            1;
          const isInLevelRange =
            (level: number) =>
            (entity: { level: number }): boolean =>
              entity.level >= level && entity.level <= level + step - 1;

          return range(
            firstBlockOfCurrentCycle.level,
            lastBlockLevelInCycle + 1 /* range doesn't include end */,
            step
          ).map((level) => {
            const to = Math.min(level + step - 1, lastBlockLevelInCycle);

            return {
              isInFuture:
                to < latestBlock.level ? -1 : level > latestBlock.level ? 1 : 0,
              from: level,
              to,
              endorsements:
                endorsingRightsFromCurrentCycle?.endorsingRewardsDetails.filter(
                  isInLevelRange(level)
                ).length,
              bakes: bakingRightsFromCurrentCycle?.bakingRewardsDetails.filter(
                isInLevelRange(level)
              ).length,
            };
          });
        }
      )
    );
    this.rightsPerBlockLevelBusy$ = combineLatest([
      this.store$.select((state) => state.app.firstBlockOfCurrentCycle),
      this.store$.select((state) => state.app.protocolVariables),
    ]).pipe(
      filter(
        ([firstBlockOfCurrentCycle, protocolVariables]) =>
          !!firstBlockOfCurrentCycle && !!protocolVariables
      ),
      map(([firstBlockOfCurrentCycle, protocolVariables]) => {
        const step = 6;
        const lastBlockLevelInCycle =
          firstBlockOfCurrentCycle.level +
          protocolVariables.blocks_per_cycle -
          1;

        return range(
          firstBlockOfCurrentCycle.level,
          lastBlockLevelInCycle + 1 /* range doesn't include end */,
          step
        ).map((level) => {
          const to = Math.min(level + step - 1, lastBlockLevelInCycle);

          return {
            isInFuture: undefined,
            from: level,
            to,
            endorsements: undefined,
            bakes: undefined,
          };
        });
      })
    );

    this.subscriptions.push(
      this.activatedRoute.paramMap.subscribe((paramMap) => {
        const address = paramMap.get('id');
        const jsonAccount = jsonAccounts[address];

        this.reset();
        this.setTabs(address);
        this.store$.dispatch(actions.loadBalanceForLast30Days({ address }));
        this.getBakingInfos(address);

        if (jsonAccount) {
          this.hasAlias = !!this.aliasPipe.transform(address);
          this.hasLogo = jsonAccount.hasLogo;
          this.isExchange = jsonAccount.isExchange;
        }

        this.bakerTableInfos = {
          ...this.bakerTableInfos,
          acceptsDelegations: get<JsonAccount>((_jsonAccount) =>
            doesAcceptsDelegations(_jsonAccount)
          )(jsonAccount),
        };

        this.revealed$ = this.accountService.getAccountStatus(address);
      }),

      this.store$
        .select((state) => state.accountDetails.delegatedAccounts)
        .pipe(filter((delegatedAccounts) => delegatedAccounts !== undefined))
        .subscribe((delegatedAccounts) => {
          const delegatedAccount: Account = first(delegatedAccounts);

          if (!delegatedAccounts /* null */) {
            this.delegatedAccountAddress = undefined;

            return;
          }

          if (
            !delegatedAccount /* delegatedAccounts is [<empty> | null | undefined] */
          ) {
            this.delegatedAccountAddress = '';

            return;
          }

          this.delegatedAccountAddress = delegatedAccount.account_id;
          this.bakerAddress = delegatedAccount.delegate_value;
          this.delegatedAmount = delegatedAccount.balance;
          this.setRewardAmont();
        }),

      // refresh account
      this.activatedRoute.paramMap
        .pipe(
          map((paramMap) => paramMap.get('id')),
          filter(negate(isNil)),
          switchMap((address) =>
            getRefresh([
              this.actions$.pipe(ofType(actions.loadAccountSucceeded)),
              this.actions$.pipe(ofType(actions.loadAccountFailed)),
            ]).pipe(map((refreshIndex) => address))
          )
        )
        .subscribe((address) =>
          this.store$.dispatch(actions.loadAccount({ address }))
        ),

      // refresh transactions
      combineLatest([
        this.activatedRoute.paramMap.pipe(
          filter((paramMap) => !!paramMap.get('id'))
        ),
        getRefresh([
          this.actions$.pipe(ofType(actions.loadTransactionsByKindSucceeded)),
          this.actions$.pipe(ofType(actions.loadTransactionsByKindFailed)),
        ]),
      ])
        .pipe(
          withLatestFrom(
            this.store$.select((state) => state.accountDetails.kind)
          )
        )
        .subscribe(([action, kind]) =>
          this.store$.dispatch(
            actions.loadTransactionsByKind({
              kind: kind || OperationTypes.Transaction,
            })
          )
        ),

      this.account$
        .pipe(
          withLatestFrom(
            this.store$.select((state) => state.app.navigationHistory)
          ),
          filter(
            ([account, navigationHistory]) =>
              !this.scrolledToTransactions &&
              account &&
              navigationHistory.length === 1
          ),
          delay(500)
        )
        .subscribe(() => {
          this.transactions.nativeElement.scrollIntoView({
            behavior: 'smooth',
          });
          this.scrolledToTransactions = true;
        }),

      this.store$
        .select((state) => state.accountDetails.counts)
        .pipe(filter((counts) => !!counts))
        .subscribe((counts) => {
          return (this.tabs = updateTabCounts(this.tabs, counts));
        }),

      this.contractAssets$
        .pipe(
          filter((contractAssets) =>
            contractAssets.some((contractAsset) =>
              isInBTC(contractAsset.contract.symbol)
            )
          ),
          switchMap(() =>
            getRefresh([
              this.actions$.pipe(ofType(appActions.loadExchangeRateSucceeded)),
              this.actions$.pipe(ofType(appActions.loadExchangeRateFailed)),
            ])
          )
        )
        .subscribe(() =>
          this.store$.dispatch(
            appActions.loadExchangeRate({ from: 'BTC', to: 'USD' })
          )
        )
    );

    this.titleService.setTitle(
      `${this.aliasService.getFormattedAddress(this.address)} - tezblock`
    );
    this.metaTagService.updateTag({
      name: 'description',
      content: `Tezos Account Address ${this.address}. The transactions, balances, rewards, baker information, value, baking & endorsing rights and a number of transactions of the account are detailed on tezblock.">`,
    });
  }

  private getBakingInfos(address: string) {
    const payoutAddress = jsonAccounts.hasOwnProperty(address)
      ? jsonAccounts[address].hasPayoutAddress
      : null;

    this.store$.dispatch(actions.loadBakingBadRatings({ address }));
    // this.store$.dispatch(actions.loadTezosBakerRating({ address, updateFee: false }))

    this.subscriptions.push(
      this.store$
        .select((state) => state.accountDetails.bakerTableRatings)
        .pipe(
          map((bakerTableRatings) =>
            get<BakerTableRatings>(
              (bakerTableRatings) => bakerTableRatings.stakingCapacity
            )(bakerTableRatings)
          ),
          filter(negate(isNil)),
          take(1),
          switchMap((stakingCapacity) =>
            this.bakingService.getBakerInfos(address).pipe(
              map((bakerInfos) => {
                if (!bakerInfos) {
                  return null;
                }

                const stakingBalance: number = bakerInfos.staking_balance;
                const stakingProgress: number = Math.min(
                  100,
                  (1 - (stakingCapacity - stakingBalance) / stakingCapacity) *
                    100
                );
                const stakingBond: number =
                  bakerInfos.staking_balance - bakerInfos.delegated_balance;

                return {
                  fullBalance: bakerInfos.balance,
                  stakingBalance: bakerInfos.staking_balance,
                  numberOfRolls: Math.floor(
                    bakerInfos.staking_balance / (8000 * 1000000)
                  ),
                  stakingCapacity,
                  stakingProgress,
                  stakingBond,
                  frozenBalance: bakerInfos.frozen_balance,
                };
              })
            )
          )
        )
        .subscribe((bakerInfos) => {
          this.bakerTableInfos = {
            ...this.bakerTableInfos,
            ...bakerInfos,
            payoutAddress,
          };
        })
    );
  }

  private setRewardAmont() {
    const delegatedAccountIsNotABaker = this.bakerAddress !== this.address;

    if (delegatedAccountIsNotABaker) {
      const notHandled =
        this.rewardAmountSetFor.account !== this.address ||
        this.rewardAmountSetFor.baker !== this.bakerAddress;

      if (notHandled) {
        this.rewardAmountSetFor = {
          account: this.address,
          baker: this.bakerAddress,
        };
        this.store$.dispatch(
          actions.loadRewardAmont({
            accountAddress: this.address,
            bakerAddress: this.bakerAddress,
          })
        );
      }

      return;
    }

    this.rewardAmountSetFor = {
      account: this.address,
      baker: this.bakerAddress,
    };
    this.store$.dispatch(
      actions.loadRewardAmontSucceeded({ rewardAmount: null })
    );
  }

  tabSelected(kind: string) {
    if (kind !== 'assets') {
      this.store$.dispatch(actions.loadTransactionsByKind({ kind }));
      return;
    }

    this.store$.dispatch(actions.setKind({ kind }));
  }

  onLoadMore() {
    this.store$.dispatch(actions.increasePageSize());
  }

  copyToClipboard(val: string) {
    this.copyService.copyToClipboard(val);
  }

  showQr() {
    const initialState = { qrdata: this.address, size: 260 };
    const modalRef = this.modalService.show(QrModalComponent, {
      class: 'modal-sm',
      initialState,
    });
    modalRef.content.closeBtnName = 'Close';
  }

  showTelegramModal() {
    const initialState = {
      botAddress: this.address,
      botName: this.aliasPipe.transform(this.address),
    };
    const modalRef = this.modalService.show(TelegramModalComponent, {
      initialState,
    });
    modalRef.content.closeBtnName = 'Close';
  }
  showMoreItems() {
    this.paginationLimit = this.paginationLimit + 50; // TODO: set dynamic number
  }

  showLessItems() {
    this.paginationLimit = this.paginationLimit - 50; // TODO: set dynamic number
  }

  replaceAll(string: string, find: string, replace: string) {
    return string.replace(new RegExp(find, 'g'), replace);
  }

  changeState(address: string) {
    this.current = this.current === 'copyGrey' ? 'copyTick' : 'copyGrey';
    setTimeout(() => {
      this.current = 'copyGrey';
    }, 1500);
    this.toastrService.success(
      this.translateService.instant('copy-modal.has-been-copied'),
      address
    );
  }

  sortBy(orderBy: OrderBy) {
    this.store$.dispatch(actions.sortTransactionsByKind({ orderBy }));
  }

  showAssets() {
    const kind = 'assets';
    const tab = this.tabs.find((_tab) => _tab.kind === kind);

    this.store$.dispatch(actions.setKind({ kind }));
    this.tabbedTableComponent.onSelectTab(tab);
  }

  onDelegationControlSelect(e: TypeaheadMatch) {
    this.selectedDelegation = e.value;
    this.delegationControl.setValue(null);
  }

  delegate() {
    this.beaconService
      .delegate(this.selectedDelegation)
      .then((response: OperationResponseOutput) => {
        this.store$.dispatch(actions.loadDelegation());
      })
      .catch((operationError: BeaconBaseMessage) => {
        // make any action ?
      });
  }

  setTooltip(item: RightsPerBlockLevel) {
    this.rightsPerBlockLevelTooltipContext = item;
  }

  areRightsForBlockRange(item: RightsPerBlockLevel): boolean {
    return item?.bakes > 0 || item?.endorsements > 0;
  }

  private setupDelegation() {
    const sortBakersAlphabeticaly = (
      a: JsonAccountData,
      b: JsonAccountData
    ): number => a.alias.localeCompare(b.alias);
    const bakers = getBakers()
      .filter(doesAcceptsDelegations)
      .sort(sortBakersAlphabeticaly);

    this.delegationControl = new FormControl(null);
    this.delegationControlDataSource$ = new BehaviorSubject(
      bakers.map((baker) => baker.address)
    );
    this.selectedDelegation = get<JsonAccountData>((baker) => baker.address)(
      bakers.find((baker) => baker.alias === 'AirGap')
    );

    this.subscriptions.push(
      this.delegationControl.valueChanges.subscribe((value) => {
        if (!value) {
          this.delegationControlDataSource$.next(
            bakers.map((baker) => baker.address)
          );
        }

        const filteredBakers = bakers
          .filter(
            (baker) =>
              baker.alias.toLowerCase().indexOf(value.toLowerCase()) !== -1
          )
          .map((baker) => baker.address);
        this.delegationControlDataSource$.next(filteredBakers);
      })
    );
  }

  private setTabs(pageId: string) {
    this.tabs = [
      {
        title: this.translateService.instant(
          'tabbed-table.account-detail.transactions'
        ),
        active: true,
        kind: 'transaction',
        count: undefined,
        icon: this.iconPipe.transform('exchangeAlt'),
        columns: columns[OperationTypes.Transaction](
          { pageId, showFiatValue: this.isMainnet },
          this.translateService
        ),
        disabled: function () {
          return !this.count;
        },
      },
      {
        title: this.translateService.instant(
          'tabbed-table.account-detail.delegations'
        ),
        active: false,
        kind: 'delegation',
        count: undefined,
        icon: this.iconPipe.transform('handReceiving'),
        columns: columns[OperationTypes.Delegation](
          { pageId, showFiatValue: this.isMainnet },
          this.translateService
        ),
        disabled: function () {
          return !this.count;
        },
      },
      {
        title: this.translateService.instant(
          'tabbed-table.account-detail.originations'
        ),
        active: false,
        kind: 'origination',
        count: undefined,
        icon: this.iconPipe.transform('link'),
        columns: columns[OperationTypes.Origination](
          { pageId, showFiatValue: this.isMainnet },
          this.translateService
        ),
        disabled: function () {
          return !this.count;
        },
      },
      {
        title: this.translateService.instant(
          'tabbed-table.account-detail.endorsements'
        ),
        active: false,
        kind: 'endorsement',
        count: undefined,
        icon: this.iconPipe.transform('stamp'),
        columns: columns[OperationTypes.Endorsement](
          { pageId, showFiatValue: this.isMainnet },
          this.translateService
        ),
        disabled: function () {
          return !this.count;
        },
      },
      {
        title: 'Assets',
        active: false,
        kind: 'assets',
        count: undefined,
        icon: this.iconPipe.transform('coins'),
        columns: columns[OperationTypes.Contract](
          { pageId, showFiatValue: this.isMainnet },
          this.translateService
        ),
        disabled: function () {
          return !this.count;
        },
      },
      {
        title: 'Collectibles',
        active: false,
        kind: 'collectibles',
        count: undefined,
        icon: this.iconPipe.transform('coins'),
        columns: columns[OperationTypes.Collectibles](
          { pageId, showFiatValue: this.isMainnet },
          this.translateService
        ),
        disabled: function () {
          return !this.count;
        },
      },
    ];

    this.bakerTabs = [
      {
        title: this.translateService.instant(
          'baker-table.baker-overview.baker-overview'
        ),
        active: true,
        kind: 'baker_overview',
        count: undefined,
        icon: this.iconPipe.transform('hatChef'),
        disabled: function () {
          return !this.count;
        },
      },
      {
        title: this.translateService.instant(
          'baker-table.baking-rights.baking-rights'
        ),
        active: false,
        kind: 'baking_rights',
        count: undefined,
        icon: this.iconPipe.transform('breadLoaf'),
        disabled: function () {
          return !this.count;
        },
      },
      {
        title: this.translateService.instant(
          'baker-table.endorsing-rights.endorsing-rights'
        ),
        active: false,
        kind: 'endorsing_rights',
        count: undefined,
        icon: this.iconPipe.transform('stamp'),
        disabled: function () {
          return !this.count;
        },
      },
      {
        title: this.translateService.instant('baker-table.rewards.rewards'),
        active: false,
        kind: 'rewards',
        count: undefined,
        icon: this.iconPipe.transform('coin'),
        disabled: function () {
          return !this.count;
        },
      },
      {
        title: this.translateService.instant('baker-table.votes'),
        active: false,
        kind: 'ballot',
        count: undefined,
        icon: this.iconPipe.transform('boxBallot'),
        columns: columns[OperationTypes.Ballot](
          { pageId, showFiatValue: this.isMainnet },
          this.translateService
        ),
        disabled: function () {
          return this.count === 0;
        },
      },
    ];
  }

  // TODO: this function should be introduced to every page with self navigation
  // Also consider that actions.reset triggers selects
  private reset() {
    this.store$.dispatch(actions.reset());
    this.delegatedAccountAddress = undefined;
    this.delegatedAmount = undefined;
    this._bakerAddress = undefined;
    this.bakerTableInfos = undefined;
    this.hasAlias = undefined;
    this.hasLogo = undefined;
    this.isCollapsed = true;
    this.rewardAmountSetFor = { account: undefined, baker: undefined };
    this.scrolledToTransactions = false;
  }
}
