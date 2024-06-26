import { MockProxy, mock } from "jest-mock-extended";
import { firstValueFrom, of } from "rxjs";

import {
  FakeAccountService,
  makeStaticByteArray,
  mockAccountServiceWith,
  trackEmissions,
} from "../../../spec";
import { ApiService } from "../../abstractions/api.service";
import { CryptoService } from "../../platform/abstractions/crypto.service";
import { MessagingService } from "../../platform/abstractions/messaging.service";
import { StateService } from "../../platform/abstractions/state.service";
import { Utils } from "../../platform/misc/utils";
import { SymmetricCryptoKey } from "../../platform/models/domain/symmetric-crypto-key";
import { UserId } from "../../types/guid";
import { UserKey } from "../../types/key";
import { TokenService } from "../abstractions/token.service";
import { AuthenticationStatus } from "../enums/authentication-status";

import { AuthService } from "./auth.service";

describe("AuthService", () => {
  let sut: AuthService;

  let accountService: FakeAccountService;
  let messagingService: MockProxy<MessagingService>;
  let cryptoService: MockProxy<CryptoService>;
  let apiService: MockProxy<ApiService>;
  let stateService: MockProxy<StateService>;
  let tokenService: MockProxy<TokenService>;

  const userId = Utils.newGuid() as UserId;
  const userKey = new SymmetricCryptoKey(makeStaticByteArray(32) as Uint8Array) as UserKey;

  beforeEach(() => {
    accountService = mockAccountServiceWith(userId);
    messagingService = mock();
    cryptoService = mock();
    apiService = mock();
    stateService = mock();
    tokenService = mock();

    sut = new AuthService(
      accountService,
      messagingService,
      cryptoService,
      apiService,
      stateService,
      tokenService,
    );
  });

  describe("activeAccountStatus$", () => {
    const accountInfo = {
      status: AuthenticationStatus.Unlocked,
      id: userId,
      email: "email",
      name: "name",
    };

    beforeEach(() => {
      accountService.activeAccountSubject.next(accountInfo);
      tokenService.hasAccessToken$.mockReturnValue(of(true));
      cryptoService.getInMemoryUserKeyFor$.mockReturnValue(of(undefined));
    });

    it("emits LoggedOut when there is no active account", async () => {
      accountService.activeAccountSubject.next(undefined);

      expect(await firstValueFrom(sut.activeAccountStatus$)).toEqual(
        AuthenticationStatus.LoggedOut,
      );
    });

    it("emits LoggedOut when there is no access token", async () => {
      tokenService.hasAccessToken$.mockReturnValue(of(false));

      expect(await firstValueFrom(sut.activeAccountStatus$)).toEqual(
        AuthenticationStatus.LoggedOut,
      );
    });

    it("emits LoggedOut when there is no access token but has a user key", async () => {
      tokenService.hasAccessToken$.mockReturnValue(of(false));
      cryptoService.getInMemoryUserKeyFor$.mockReturnValue(of(userKey));

      expect(await firstValueFrom(sut.activeAccountStatus$)).toEqual(
        AuthenticationStatus.LoggedOut,
      );
    });

    it("emits Locked when there is an access token and no user key", async () => {
      tokenService.hasAccessToken$.mockReturnValue(of(true));
      cryptoService.getInMemoryUserKeyFor$.mockReturnValue(of(undefined));

      expect(await firstValueFrom(sut.activeAccountStatus$)).toEqual(AuthenticationStatus.Locked);
    });

    it("emits Unlocked when there is an access token and user key", async () => {
      tokenService.hasAccessToken$.mockReturnValue(of(true));
      cryptoService.getInMemoryUserKeyFor$.mockReturnValue(of(userKey));

      expect(await firstValueFrom(sut.activeAccountStatus$)).toEqual(AuthenticationStatus.Unlocked);
    });

    it("follows the current active user", async () => {
      const accountInfo2 = {
        status: AuthenticationStatus.Unlocked,
        id: Utils.newGuid() as UserId,
        email: "email2",
        name: "name2",
      };

      const emissions = trackEmissions(sut.activeAccountStatus$);

      tokenService.hasAccessToken$.mockReturnValue(of(true));
      cryptoService.getInMemoryUserKeyFor$.mockReturnValue(of(userKey));
      accountService.activeAccountSubject.next(accountInfo2);

      expect(emissions).toEqual([AuthenticationStatus.Locked, AuthenticationStatus.Unlocked]);
    });
  });

  describe("authStatusFor$", () => {
    beforeEach(() => {
      tokenService.hasAccessToken$.mockReturnValue(of(true));
      cryptoService.getInMemoryUserKeyFor$.mockReturnValue(of(undefined));
    });

    it("emits LoggedOut when userId is null", async () => {
      expect(await firstValueFrom(sut.authStatusFor$(null))).toEqual(
        AuthenticationStatus.LoggedOut,
      );
    });

    it("emits LoggedOut when there is no access token", async () => {
      tokenService.hasAccessToken$.mockReturnValue(of(false));

      expect(await firstValueFrom(sut.authStatusFor$(userId))).toEqual(
        AuthenticationStatus.LoggedOut,
      );
    });

    it("emits Locked when there is an access token and no user key", async () => {
      tokenService.hasAccessToken$.mockReturnValue(of(true));
      cryptoService.getInMemoryUserKeyFor$.mockReturnValue(of(undefined));

      expect(await firstValueFrom(sut.authStatusFor$(userId))).toEqual(AuthenticationStatus.Locked);
    });

    it("emits Unlocked when there is an access token and user key", async () => {
      tokenService.hasAccessToken$.mockReturnValue(of(true));
      cryptoService.getInMemoryUserKeyFor$.mockReturnValue(of(userKey));

      expect(await firstValueFrom(sut.authStatusFor$(userId))).toEqual(
        AuthenticationStatus.Unlocked,
      );
    });
  });
});
