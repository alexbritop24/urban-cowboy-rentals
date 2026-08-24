import { urbanCowboyDocumentBrand } from "../../utils/documentPresentation";

export default function CompanySection() {
  return (
    <div className="rounded-3xl border border-yellow-500/10 bg-black/25 p-6">

      <p className="text-xs font-black uppercase tracking-[0.2em] text-[#f4b000]">
        Rental Company
      </p>

      <h2 className="mt-3 text-2xl font-black text-white">
        {urbanCowboyDocumentBrand.legalName}
      </h2>

      <div className="mt-5 space-y-2 text-[#d2c7bb]">

        <p>{urbanCowboyDocumentBrand.streetAddress}</p>

        <p>{urbanCowboyDocumentBrand.locality}</p>

        <p>{urbanCowboyDocumentBrand.phone}</p>

        <p>{urbanCowboyDocumentBrand.email}</p>

        <p>urbancowboyrentals.com</p>

      </div>

    </div>
  );
}
