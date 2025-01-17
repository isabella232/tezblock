import { TezosNetwork } from '@airgap/coinlib-core';
import {
  animate,
  state,
  style,
  transition,
  trigger,
} from '@angular/animations';
import { Component, OnInit } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';
import { Actions, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { TranslateService } from '@ngx-translate/core';
import * as appActions from '@tezblock/app.actions';
import { BaseComponent } from '@tezblock/components/base.component';
import { isConvertableToUSD } from '@tezblock/domain/airgap';
import {
  ContractOperation,
  hasTokenHolders,
  Social,
  SocialType,
  TokenContract,
} from '@tezblock/domain/contract';
import { getRefresh } from '@tezblock/domain/synchronization';
import { Count, Tab, updateTabCounts } from '@tezblock/domain/tab';
import { dataSelector } from '@tezblock/domain/table';
import { AliasPipe } from '@tezblock/pipes/alias/alias.pipe';
import * as fromRoot from '@tezblock/reducers';
import { AliasService } from '@tezblock/services/alias/alias.service';
import { OrderBy } from '@tezblock/services/base.service';
import { ChainNetworkService } from '@tezblock/services/chain-network/chain-network.service';
import { isNil, negate } from 'lodash';
import moment from 'moment';
import { combineLatest, Observable } from 'rxjs';
import { filter, map, switchMap } from 'rxjs/operators';
import { IconPipe } from 'src/app/pipes/icon/icon.pipe';

import { AccountService } from '../../services/account/account.service';

import * as actions from './actions';
import { columns } from './table-definitions';

const last24 = (transaction: ContractOperation): boolean => {
  const hoursAgo = moment().diff(moment(transaction.timestamp), 'hours', true);

  return hoursAgo <= 24;
};

@Component({
  selector: 'app-contract-detail',
  templateUrl: './contract-detail.component.html',
  styleUrls: ['./contract-detail.component.scss'],
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
  ],
})
export class ContractDetailComponent extends BaseComponent implements OnInit {
  public address$: Observable<string>;
  public contract$: Observable<TokenContract>;
  public website$: Observable<string>;
  public twitter$: Observable<string>;
  public telegram$: Observable<string>;
  public medium$: Observable<string>;
  public github$: Observable<string>;
  public copyToClipboardState$: Observable<string>;
  public revealed$: Observable<string>;
  public hasAlias$: Observable<boolean>;
  public loading$: Observable<boolean>;
  public transactions$: Observable<any[]>;
  public orderBy$: Observable<OrderBy>;
  public current: string = 'copyGrey';
  public manager$: Observable<string>;
  public showFiatValue$: Observable<boolean>;
  public transactions24hCount$: Observable<number>;
  public transactions24hVolume$: Observable<string>;

  public tabs: Tab[] = [
    {
      title: 'Transfers',
      active: true,
      kind: actions.OperationTab.transfers,
      count: undefined,
      icon: this.iconPipe.transform('exchangeAlt'),
      columns: undefined,
      disabled: function () {
        return !this.count;
      },
    },
    {
      title: 'Other Calls',
      active: false,
      kind: actions.OperationTab.other,
      count: undefined,
      icon: this.iconPipe.transform('link'),
      columns: undefined,
      disabled: function () {
        return !this.count;
      },
    },
    {
      title: 'Entrypoints',
      active: false,
      kind: actions.OperationTab.entrypoints,
      count: undefined,
      icon: this.iconPipe.transform('link'),
      columns: columns.entrypoints(),
      disabled: function () {
        return !this.count;
      },
    },
  ];

  get contractAddress(): string {
    return this.activatedRoute.snapshot.params.id;
  }

  get isMainnet(): boolean {
    return this.chainNetworkService.getNetwork() === TezosNetwork.MAINNET;
  }

  constructor(
    private readonly actions$: Actions,
    private readonly accountService: AccountService,
    private readonly activatedRoute: ActivatedRoute,
    private readonly aliasPipe: AliasPipe,
    private readonly chainNetworkService: ChainNetworkService,
    private readonly store$: Store<fromRoot.State>,
    private readonly iconPipe: IconPipe,
    private translateService: TranslateService,
    private titleService: Title,
    private metaTagService: Meta,
    private aliasService: AliasService
  ) {
    super();

    this.subscriptions.push(
      this.activatedRoute.paramMap.subscribe((paramMap) => {
        const address = paramMap.get('id');

        this.store$.dispatch(actions.reset());
        this.store$.dispatch(actions.loadContract({ address }));

        this.revealed$ = this.accountService.getAccountStatus(address);
      })
    );
  }

  public ngOnInit() {
    this.address$ = this.store$.select(
      (state) => state.contractDetails.address
    );
    this.contract$ = this.store$.select(
      (state) => state.contractDetails.contract
    );
    this.website$ = this.getSocial(
      (social) => social.type === SocialType.website
    );
    this.twitter$ = this.getSocial(
      (social) => social.type === SocialType.twitter
    );
    this.telegram$ = this.getSocial(
      (social) => social.type === SocialType.telegram
    );
    this.medium$ = this.getSocial(
      (social) => social.type === SocialType.medium
    );
    this.github$ = this.getSocial(
      (social) => social.type === SocialType.github
    );
    this.copyToClipboardState$ = this.store$.select(
      (state) => state.contractDetails.copyToClipboardState
    );
    this.hasAlias$ = this.store$
      .select((state) => state.contractDetails.address)
      .pipe(map((address) => address && !!this.aliasPipe.transform(address)));
    this.transactions$ = combineLatest([
      this.store$.select((state) => state.contractDetails.currentTabKind),
      this.store$.select(fromRoot.contractDetails.transferOperations),
      this.store$.select((state) => state.contractDetails.otherOperations.data),
      this.store$.select((state) => state.contractDetails.tokenHolders),
      this.store$.select((state) => state.contractDetails.entrypoints),
    ]).pipe(
      map(
        ([
          currentTabKind,
          transferOperations,
          otherOperations,
          tokenHolders,
          entrypoints,
        ]) => {
          if (currentTabKind === actions.OperationTab.transfers) {
            return transferOperations;
          }

          if (currentTabKind === actions.OperationTab.other) {
            return otherOperations;
          }

          if (currentTabKind === actions.OperationTab.tokenHolders) {
            // client-side paging
            return dataSelector(tokenHolders);
          }

          return dataSelector(entrypoints);
        }
      )
    );
    this.loading$ = combineLatest([
      this.store$.select(
        (state) => state.contractDetails.transferOperations.loading
      ),
      this.store$.select(
        (state) => state.contractDetails.otherOperations.loading
      ),
    ]).pipe(
      map(
        ([transferOperationsLoading, otherOperationsLoading]) =>
          transferOperationsLoading || otherOperationsLoading
      )
    );
    this.orderBy$ = combineLatest([
      this.store$.select((state) => state.contractDetails.currentTabKind),
      this.store$.select(
        (state) => state.contractDetails.transferOperations.orderBy
      ),
      this.store$.select(
        (state) => state.contractDetails.otherOperations.orderBy
      ),
    ]).pipe(
      map(([currentTabKind, transferOrderBy, otherOrderBy]) =>
        currentTabKind === actions.OperationTab.transfers
          ? transferOrderBy
          : otherOrderBy
      )
    );
    this.manager$ = this.store$.select(
      (state) => state.contractDetails.manager
    );
    this.showFiatValue$ = this.contract$.pipe(
      map((contract) => contract && isConvertableToUSD(contract.symbol))
    );
    this.transactions24hCount$ = this.store$.select(
      (state) => state.contractDetails.transfer24hCount
    );
    this.transactions24hVolume$ = this.store$.select(
      (state) => state.contractDetails.transfer24hVolume
    );

    this.subscriptions.push(
      combineLatest([
        this.address$,
        this.contract$,
        combineLatest([
          this.store$.select(
            (state) => state.contractDetails.transferOperations.pagination.total
          ),
          this.store$.select(
            (state) => state.contractDetails.otherOperations.pagination.total
          ),
          this.store$.select(
            (state) => state.contractDetails.tokenHolders.pagination.total
          ),
          this.store$.select(
            (state) => state.contractDetails.entrypoints.pagination.total
          ),
        ]).pipe(
          map(
            ([
              transferCount,
              otherCount,
              tokenHoldersCount,
              entrypointsCount,
            ]) => [
              { key: actions.OperationTab.transfers, count: transferCount },
              { key: actions.OperationTab.other, count: otherCount },
              {
                key: actions.OperationTab.tokenHolders,
                count: tokenHoldersCount,
              },
              {
                key: actions.OperationTab.entrypoints,
                count: entrypointsCount,
              },
            ]
          )
        ),
      ])
        .pipe(filter(([address, contract]) => !!address && !!contract))
        .subscribe(([address, contract, counts]) =>
          this.updateTabs(address, contract, counts)
        ),

      this.contract$
        .pipe(
          filter(
            (contract) => contract && ['tzBTC', 'BTC'].includes(contract.symbol)
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

    this.contract$
      .pipe(filter((contract) => contract !== undefined))
      .subscribe((contract) =>
        this.store$.dispatch(actions.load24hTransferVolume({ contract }))
      );

    this.titleService.setTitle(
      `${this.aliasService.getFormattedAddress(
        this.contractAddress
      )} Contract - tezblock`
    );
    this.metaTagService.updateTag({
      name: 'description',
      content: `Tezos Contract Address ${this.contractAddress}. The name, symbol, total supply, manager, description, website, transfers and other calls of transactions of the contract are detailed on tezblock.">`,
    });
  }

  public showQr() {
    this.store$.dispatch(actions.showQr());
  }

  public showTelegramModal() {
    this.store$.dispatch(actions.showTelegramModal());
  }

  public copyToClipboard(address: string) {
    this.store$.dispatch(actions.copyAddressToClipboard({ address }));
  }

  public loadMore() {
    this.store$.dispatch(actions.loadMore());
  }

  public tabSelected(currentTabKind: actions.OperationTab) {
    setTimeout(
      () =>
        this.store$.dispatch(actions.changeOperationsTab({ currentTabKind })),
      0
    );
  }

  public sortBy(orderBy: OrderBy) {
    this.store$.dispatch(actions.sortOperations({ orderBy }));
  }

  private getTokenHoldersTab(options: {
    pageId: string;
    showFiatValue: boolean;
    symbol: string;
  }) {
    return {
      title: 'Token Holders',
      active: false,
      kind: actions.OperationTab.tokenHolders,
      count: undefined,
      icon: this.iconPipe.transform('link'),
      columns: columns.tokenHolders(options),
      disabled: function () {
        return !this.count;
      },
    };
  }

  private getSocial(
    condition: (social: Social) => boolean
  ): Observable<string> {
    return this.store$
      .select((state) => state.contractDetails.contract)
      .pipe(
        filter(negate(isNil)),
        map((contract) => {
          const match = contract.socials.find(condition);

          return match ? match.url : null;
        })
      );
  }

  private updateTabs(pageId: string, contract: TokenContract, counts: Count[]) {
    const showFiatValue = isConvertableToUSD(contract.symbol);
    const options = {
      pageId,
      showFiatValue,
      symbol: contract.symbol,
    };
    const customTabs = hasTokenHolders(contract)
      ? [this.getTokenHoldersTab(options)]
      : [];
    const tabs = [
      {
        ...this.tabs[0],
        columns: columns.transfers(options, this.translateService),
      },
      {
        ...this.tabs[1],
        columns: columns.other(options, this.translateService),
      },
      {
        ...this.tabs[2],
        columns: columns.entrypoints(),
      },
    ].concat(customTabs);
    this.tabs = updateTabCounts(tabs, counts);
  }
}
