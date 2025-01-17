import {
  Component,
  Input,
  OnInit,
  ChangeDetectionStrategy,
} from '@angular/core';
import { Store } from '@ngrx/store';
import { Observable } from 'rxjs';

import { TokenContract, ContractOperation } from '@tezblock/domain/contract';
import * as fromRoot from '@tezblock/reducers';
import * as actions from './actions';

@Component({
  selector: 'app-latest-contracts-transactions',
  templateUrl: './latest-contracts-transactions.component.html',
  styleUrls: ['./latest-contracts-transactions.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LatestContractsTransactionsComponent implements OnInit {
  @Input()
  set contracts(value: TokenContract[]) {
    if (value !== this._contracts) {
      this._contracts = value;
      if (value && value.length > 0) {
        this.store$.dispatch(
          actions.loadTransferOperations({ contracts: value })
        );
      }
    }
  }
  get contracts(): TokenContract[] {
    return this._contracts;
  }
  private _contracts: TokenContract[];

  transferOperations$: Observable<ContractOperation[]>;

  constructor(private readonly store$: Store<fromRoot.State>) {}

  ngOnInit() {
    this.transferOperations$ = this.store$.select(
      (state) => state.dashboardLatestContractsTransactions.transferOperations
    );
  }
}
