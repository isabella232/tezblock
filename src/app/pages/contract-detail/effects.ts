import { Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { of } from 'rxjs';
import {
  catchError,
  delay,
  filter,
  map,
  tap,
  withLatestFrom,
  switchMap,
} from 'rxjs/operators';
import { Store } from '@ngrx/store';
import { BsModalService } from 'ngx-bootstrap/modal';
import { ToastrService } from 'ngx-toastr';

import * as actions from './actions';
import * as fromRoot from '@tezblock/reducers';
import { CopyService } from '@tezblock/services/copy/copy.service';
import { QrModalComponent } from '@tezblock/components/qr-modal/qr-modal.component';
import { TelegramModalComponent } from '@tezblock/components/telegram-modal/telegram-modal.component';
import { AliasPipe } from '@tezblock/pipes/alias/alias.pipe';
import {
  getTokenContractByAddress,
  hasTokenHolders,
} from '@tezblock/domain/contract';
import { ApiService } from '@tezblock/services/api/api.service';
import { ContractService } from '@tezblock/services/contract/contract.service';
import { ChainNetworkService } from '@tezblock/services/chain-network/chain-network.service';
import { maxLimit } from '@tezblock/services/base.service';

@Injectable()
export class ContractDetailEffects {
  getContract$ = createEffect(() =>
    this.actions$.pipe(
      ofType(actions.loadContract),
      switchMap(({ address }) => {
        const contract = getTokenContractByAddress(
          address,
          this.chainNetworkService.getNetwork()
        );

        if (contract) {
          return this.contractService.getTotalSupplyByContract(contract).pipe(
            map((totalSupply) =>
              actions.loadContractSucceeded({
                contract: { ...contract, totalSupply },
              })
            ),
            catchError((error) => of(actions.loadContractFailed({ error })))
          );
        }

        return of(actions.loadContractFailed({ error: 'Not Found' }));
      })
    )
  );

  onLoadContractLoadAccount$ = createEffect(() =>
    this.actions$.pipe(
      ofType(actions.loadContract),
      map(({ address }) => actions.loadManagerAddress({ address }))
    )
  );

  loadManagerAddress$ = createEffect(() =>
    this.actions$.pipe(
      ofType(actions.loadManagerAddress),
      switchMap(({ address }) =>
        this.contractService.loadManagerAddress(address).pipe(
          map((manager) => actions.loadManagerAddressSucceeded({ manager })),
          catchError((error) => of(actions.loadManagerAddressFailed({ error })))
        )
      )
    )
  );

  onContractGetOperations$ = createEffect(() =>
    this.actions$.pipe(
      ofType(actions.loadContractSucceeded),
      map(({ contract }) => actions.loadTransferOperations({ contract }))
    )
  );

  copyAddressToClipboard$ = createEffect(() =>
    this.actions$.pipe(
      ofType(actions.copyAddressToClipboard),
      tap(({ address }) => {
        this.copyService.copyToClipboard(address);
        this.toastrService.success('has been copied to clipboard', address);
      }),
      map(() => actions.copyAddressToClipboardSucceeded())
    )
  );

  oncopyAddressToClipboardSucceeded$ = createEffect(() =>
    this.actions$.pipe(
      ofType(actions.copyAddressToClipboardSucceeded),
      delay(1500),
      map(() => actions.resetCopyToClipboardState())
    )
  );

  showQr$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(actions.showQr),
        withLatestFrom(
          this.store$.select((state) => state.contractDetails.address)
        ),
        tap(([action, address]) => {
          const initialState = { qrdata: address, size: 200 };
          const modalRef = this.modalService.show(QrModalComponent, {
            initialState,
          });
          modalRef.content.closeBtnName = 'Close';
        })
      ),
    { dispatch: false }
  );

  showTelegramModal$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(actions.showTelegramModal),
        withLatestFrom(
          this.store$.select((state) => state.contractDetails.address)
        ),
        tap(([action, address]) => {
          const initialState = {
            botAddress: address,
            botName: this.aliasPipe.transform(address),
          };
          const modalRef = this.modalService.show(TelegramModalComponent, {
            initialState,
          });
          modalRef.content.closeBtnName = 'Close';
        })
      ),
    { dispatch: false }
  );

  loadTransferOperations$ = createEffect(() =>
    this.actions$.pipe(
      ofType(actions.loadTransferOperations),
      withLatestFrom(
        this.store$.select(
          (state) => state.contractDetails.transferOperations.orderBy
        ),
        this.store$.select(
          (state) => state.contractDetails.transferOperations.pagination
        )
      ),
      switchMap(([{ contract }, orderBy, pagination]) =>
        this.contractService
          .loadTransferOperations(
            contract,
            orderBy,
            pagination.currentPage * pagination.selectedSize
          )
          .pipe(
            map((data) => actions.loadTransferOperationsSucceeded({ data })),
            catchError((error) =>
              of(actions.loadTransferOperationsFailed({ error }))
            )
          )
      )
    )
  );

  loadMoreTransferOperations$ = createEffect(() =>
    this.actions$.pipe(
      ofType(actions.loadMoreTransferOperations),
      withLatestFrom(
        this.store$.select((state) => state.contractDetails.contract)
      ),
      map(([action, contract]) => actions.loadTransferOperations({ contract }))
    )
  );

  onLoadTransactionsSucceededLoadErrors$ = createEffect(() =>
    this.actions$.pipe(
      ofType(actions.loadTransferOperationsSucceeded),
      filter(({ data }) =>
        data.some((transaction) => transaction.status !== 'applied')
      ),
      map(({ data }) => actions.loadTransactionsErrors({ transactions: data }))
    )
  );

  loadTransactionsErrors$ = createEffect(() =>
    this.actions$.pipe(
      ofType(actions.loadTransactionsErrors),
      switchMap(({ transactions }) =>
        this.apiService.getErrorsForOperations(transactions).pipe(
          map((operationErrorsById) =>
            actions.loadTransactionsErrorsSucceeded({ operationErrorsById })
          ),
          catchError((error) =>
            of(actions.loadTransactionsErrorsFailed({ error }))
          )
        )
      )
    )
  );

  load24hTransferVolume$ = createEffect(() =>
    this.actions$.pipe(
      ofType(actions.load24hTransferVolume),
      switchMap(({ contract }) =>
        this.contractService.load24hTransferOperations(contract).pipe(
          map((data) => actions.load24hTransferVolumeSucceeded({ data })),
          catchError((error) =>
            of(actions.load24hTransferVolumeFailed({ error }))
          )
        )
      )
    )
  );

  onLoadOperationsLoadCounts$ = createEffect(() =>
    this.actions$.pipe(
      ofType(actions.loadTransferOperations, actions.loadOtherOperations),
      withLatestFrom(
        this.store$.select((state) => state.contractDetails.contract)
      ),
      map(([action, contract]) =>
        actions.loadOperationsCount({ contractHash: contract.id })
      )
    )
  );

  loadOperationsCount$ = createEffect(() =>
    this.actions$.pipe(
      ofType(actions.loadOperationsCount),
      switchMap(({ contractHash }) =>
        this.contractService.loadOperationsCount(contractHash).pipe(
          map(({ transferTotal, otherTotal }) =>
            actions.loadOperationsCountSucceeded({ transferTotal, otherTotal })
          ),
          catchError((error) =>
            of(actions.loadOperationsCountFailed({ error }))
          )
        )
      )
    )
  );

  loadOtherOperations$ = createEffect(() =>
    this.actions$.pipe(
      ofType(actions.loadOtherOperations),
      withLatestFrom(
        this.store$.select(
          (state) => state.contractDetails.otherOperations.pagination
        ),
        this.store$.select(
          (state) => state.contractDetails.otherOperations.orderBy
        )
      ),
      switchMap(([{ contract: contractHash }, pagination, orderBy]) =>
        this.contractService
          .loadOtherOperations(
            contractHash,
            orderBy,
            pagination.currentPage * pagination.selectedSize
          )
          .pipe(
            map((data) => actions.loadOtherOperationsSucceeded({ data })),
            catchError((error) =>
              of(actions.loadOtherOperationsFailed({ error }))
            )
          )
      )
    )
  );

  loadMoreOtherOperations$ = createEffect(() =>
    this.actions$.pipe(
      ofType(actions.loadMoreOtherOperations),
      withLatestFrom(
        this.store$.select((state) => state.contractDetails.contract)
      ),
      map(([action, contract]) => actions.loadOtherOperations({ contract }))
    )
  );

  sortOtherOperations$ = createEffect(() =>
    this.actions$.pipe(
      ofType(actions.sortOtherOperations),
      withLatestFrom(
        this.store$.select((state) => state.contractDetails.contract)
      ),
      map(([action, contract]) => actions.loadOtherOperations({ contract }))
    )
  );

  onChangeOperationsTabLoadOperations$ = createEffect(() =>
    this.actions$.pipe(
      ofType(actions.changeOperationsTab),
      filter(
        ({ currentTabKind }) =>
          currentTabKind !== actions.OperationTab.tokenHolders &&
          currentTabKind !== actions.OperationTab.entrypoints
      ),
      withLatestFrom(
        this.store$.select((state) => state.contractDetails.contract)
      ),
      map(([{ currentTabKind }, contract]) =>
        currentTabKind === actions.OperationTab.transfers
          ? actions.loadTransferOperations({ contract })
          : actions.loadOtherOperations({ contract })
      )
    )
  );

  loadMore$ = createEffect(() =>
    this.actions$.pipe(
      ofType(actions.loadMore),
      withLatestFrom(
        this.store$.select((state) => state.contractDetails.currentTabKind)
      ),
      map(([action, currentTabKind]) => {
        switch (currentTabKind) {
          case actions.OperationTab.transfers:
            return actions.loadMoreTransferOperations();
          case actions.OperationTab.other:
            return actions.loadMoreOtherOperations();
          case actions.OperationTab.entrypoints:
            return actions.loadMoreEntrypoints();
          default:
            return actions.loadMoreTokenHolders();
        }
      })
    )
  );

  sortOperations$ = createEffect(() =>
    this.actions$.pipe(
      ofType(actions.sortOperations),
      withLatestFrom(
        this.store$.select((state) => state.contractDetails.currentTabKind)
      ),
      map(([{ orderBy }, currentTabKind]) =>
        // currentTabKind === actions.OperationTab.transfers
        //   ? actions.sortTransferOperations({ orderBy }) :
        actions.sortOtherOperations({ orderBy })
      )
    )
  );

  onLoadedContractLoadTokenHolders = createEffect(() =>
    this.actions$.pipe(
      ofType(actions.loadContractSucceeded),
      map(({ contract }) => actions.loadTokenHolders({ contract }))
    )
  );

  loadTokenHolders$ = createEffect(() =>
    this.actions$.pipe(
      ofType(actions.loadTokenHolders),
      filter(({ contract }) => hasTokenHolders(contract)),
      switchMap(({ contract }) =>
        this.contractService.loadTokenHolders(contract).pipe(
          map((data) => actions.loadTokenHoldersSucceeded({ data })),
          catchError((error) => of(actions.loadTokenHoldersFailed({ error })))
        )
      )
    )
  );

  onContractLoadEntrypoints$ = createEffect(() =>
    this.actions$.pipe(
      ofType(actions.loadContractSucceeded),
      map(({ contract }) => actions.loadEntrypoints({ id: contract.id }))
    )
  );

  loadEntrypoints$ = createEffect(() =>
    this.actions$.pipe(
      ofType(actions.loadEntrypoints),
      switchMap(({ id }) =>
        this.contractService.loadEntrypoints(id).pipe(
          map((data) => actions.loadEntrypointsSucceeded({ data })),
          catchError((error) => of(actions.loadEntrypointsFailed({ error })))
        )
      )
    )
  );

  constructor(
    private readonly actions$: Actions,
    private readonly aliasPipe: AliasPipe,
    private readonly apiService: ApiService,
    private readonly chainNetworkService: ChainNetworkService,
    private readonly contractService: ContractService,
    private readonly copyService: CopyService,
    private readonly modalService: BsModalService,
    private readonly store$: Store<fromRoot.State>,
    private readonly toastrService: ToastrService
  ) {}
}
