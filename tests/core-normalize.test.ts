import assert from "node:assert/strict";
import {
  buildDisplayName,
  normalizeEmail,
  normalizeOptionalText,
  normalizePhone,
  normalizeVin,
  validateNormalizedVin,
} from "@/lib/core/normalize";
import {
  parseAddressInput,
  parseCustomerInput,
  parseVehicleInput,
  parseVehicleMileageInput,
  parseVendorInput,
  ValidationError,
} from "@/lib/core/validators";

function assertValidationError(callback: () => unknown, messageIncludes: string) {
  assert.throws(callback, (error) => {
    assert.ok(error instanceof ValidationError);
    assert.match(error.message, new RegExp(messageIncludes));
    return true;
  });
}

assert.equal(normalizeOptionalText("  Lakeside   Auto  "), "Lakeside Auto");
assert.equal(normalizeOptionalText("   "), null);
assert.equal(normalizeEmail("  OWNER@Example.COM  "), "owner@example.com");
assert.equal(normalizePhone("  (555) 123-4567  "), "(555) 123-4567");

assert.equal(normalizeVin(" 1hg cm82633 a004352 "), "1HGCM82633A004352");
assert.equal(validateNormalizedVin("1HGCM82633A004352"), "1HGCM82633A004352");
assert.throws(() => validateNormalizedVin("SHORT"), /17/);
assert.throws(() => validateNormalizedVin("1IGCM82633A004352"), /cannot contain/);

assert.equal(
  buildDisplayName({ companyName: "  Metro   Truck Center  " }),
  "Metro Truck Center",
);
assert.equal(
  buildDisplayName({ firstName: "  Jamie ", lastName: "  Rivera " }),
  "Jamie Rivera",
);
assert.equal(buildDisplayName({ email: "fallback@example.com" }), "fallback@example.com");

const customer = parseCustomerInput({
  customerType: "individual",
  firstName: "  Jamie ",
  lastName: " Rivera ",
  email: " JAMIE@EXAMPLE.COM ",
  taxExempt: true,
});
assert.deepEqual(customer, {
  customerType: "INDIVIDUAL",
  displayName: "Jamie Rivera",
  companyName: null,
  firstName: "Jamie",
  lastName: "Rivera",
  email: "jamie@example.com",
  phone: null,
  website: null,
  taxExempt: true,
  taxExemptId: null,
  defaultPaymentTerms: null,
  isWalkIn: false,
  notes: null,
});

const address = parseAddressInput({
  type: "billing",
  line1: "  100 Main St ",
  city: " Springfield ",
  state: " mo ",
  country: " us ",
  isPrimary: true,
});
assert.equal(address.type, "BILLING");
assert.equal(address.line1, "100 Main St");
assert.equal(address.state, "MO");
assert.equal(address.country, "US");
assert.equal(address.isPrimary, true);

const vehicle = parseVehicleInput({
  vin: " 1hg cm82633 a004352 ",
  year: 2024,
  licensePlate: " ab 123 ",
  licenseState: "ks",
  currentMileage: 1200,
});
assert.equal(vehicle.normalizedVin, "1HGCM82633A004352");
assert.equal(vehicle.licensePlate, "AB 123");
assert.equal(vehicle.licenseState, "KS");
assert.equal(vehicle.currentMileage, 1200);

const vendor = parseVendorInput({
  vendorType: "both",
  name: "  Northline Parts  ",
  email: " Parts@Example.COM ",
});
assert.equal(vendor.vendorType, "BOTH");
assert.equal(vendor.name, "Northline Parts");
assert.equal(vendor.email, "parts@example.com");

const mileage = parseVehicleMileageInput({
  value: 1250,
  source: "manual",
  recordedAt: "2026-04-20T00:00:00.000Z",
});
assert.equal(mileage.value, 1250);
assert.equal(mileage.source, "manual");
assert.equal(mileage.recordedAt.toISOString(), "2026-04-20T00:00:00.000Z");

assertValidationError(() => parseAddressInput({ city: "Springfield" }), "line1");
assertValidationError(() => parseVehicleInput({ vin: "SHORT" }), "17");
assertValidationError(() => parseVehicleInput({ year: 1800 }), "at least");
assertValidationError(() => parseVendorInput({ name: "  " }), "name");
assertValidationError(() => parseVehicleMileageInput({ value: -1, source: "manual" }), "at least");
assertValidationError(() => parseCustomerInput(null), "JSON object");

console.log("Core normalization test: OK");
