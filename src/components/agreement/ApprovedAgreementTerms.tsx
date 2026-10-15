import type { RentalAgreement } from "../../types/agreement";
import { buildApprovedDocument } from "../../utils/approvedAgreementDocument";

export default function ApprovedAgreementTerms({agreement}: {agreement: RentalAgreement}) {
  let fixture;
  try { fixture = buildApprovedDocument(agreement); }
  catch { return <p role="alert">The saved Agreement document could not be read. Do not record acceptance until it is available.</p>; }
  if (!fixture) return null;
  return <section className="document-section document-legal border-t border-[#d8d0c6] pt-7 font-serif">
    <h2 className="mb-6 text-2xl font-bold">Equipment Lease Agreement</h2>
    {fixture.blocks.map((block,index) => {
      if (block.kind === "notice") return null;
      if (block.kind === "section") return <div key={index} className="mb-4 mt-7 break-after-avoid"><h3 className="border-b border-[#b7791f] pb-2 font-bold">{block.title}</h3><p className="mt-2 font-bold">{block.subtitle}</p></div>;
      if (block.rows) return <div key={index} className="my-5 overflow-x-auto">
        {block.title && <h3 className="mb-3 font-bold">{block.title}</h3>}
        <table className="w-full border-collapse text-left text-sm"><tbody>{block.rows.map((row,r) => <tr key={r}>{row.map((cell,c) => <td key={c} className="border border-[#d8d0c6] p-2 align-top">{cell}</td>)}</tr>)}</tbody></table>
        {block.notes?.map((note,n)=><p key={n} className="mt-2 text-sm">{note}</p>)}
      </div>;
      return <p key={index} className="mb-4 whitespace-pre-wrap text-sm leading-6">{block.text}</p>;
    })}
  </section>;
}
