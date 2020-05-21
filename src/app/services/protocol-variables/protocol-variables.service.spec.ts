import { TestBed } from '@angular/core/testing';

import { UnitHelper } from 'test-config/unit-test-helper'
import { ProtocolVariablesService } from './protocol-variables.service';

describe('ProtocolVariablesService', () => {
  beforeEach(() => {
    const unitHelper = new UnitHelper()

    TestBed.configureTestingModule(unitHelper.testBed({}))
  });

  it('should be created', () => {
    const service: ProtocolVariablesService = TestBed.get(ProtocolVariablesService);
    expect(service).toBeTruthy();
  });
});
