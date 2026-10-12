// Review-only renderer. No Agreement model, active clauses, RPCs, or acceptance flow.
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { cloneElement } from "react";
import { PdfBrandHeader, PdfBrandFooter } from "../../src/components/document/pdf/DocumentPdfChrome";

const review = StyleSheet.create({
  marker: { position:"absolute", top:10, left:32, right:32, fontSize:7, color:"#7a4d00", fontWeight:"bold", textAlign:"center" },
  note: { marginBottom:14, padding:8, backgroundColor:"#fff8e7", borderWidth:0.75, borderColor:"#b7791f", fontSize:7.2, color:"#76572f" },
  field: { fontSize:8.2, marginBottom:6, color:"#211d18" },
  table: { marginBottom:14 },
});

export default function ReviewAgreementPdf({ fixture, styles }: any) {
  const documentNumber=fixture.population?.agreementNumber || "REVIEW-JASON";
  const sample=fixture.population?.sample===true;
  // Use the production footer's layout, with dynamic text to repeat reliably on
  // continuation pages produced by this long review fixture.
  const footer = PdfBrandFooter({documentType:"Agreement",documentNumber});
  const footerChildren = footer.props.children.flatMap((child: any,index: number) => {
    const text=child.props.children;
    if(!text)return [cloneElement(child,{key:`footer-${index}`})];
    const {height,paddingTop,borderTopWidth,...textStyle}=child.props.style;
    return [<View key={`footer-rule-${index}`} style={child.props.style} fixed />,
      <Text key={`footer-text-${index}`} style={{...textStyle,top:759}} fixed render={()=>text} />];
  });
  return <Document title="Jason Agreement - Review Draft" author="Urban Cowboy Rentals LLC" subject="Review only; source wording and amounts retained; not for customer signature" language="en-US">
    <Page size="LETTER" style={styles.page} wrap>
      <Text style={review.marker} fixed render={()=>`REVIEW DRAFT — NOT FOR CUSTOMER SIGNATURE${sample?" — SAMPLE DATA":""}`} />
      {footerChildren}
      <PdfBrandHeader documentType="Equipment Lease Agreement" documentNumber={documentNumber} status="review draft" dateLabel={fixture.population?"Stored effective":"Review fixture"} dateValue={fixture.population?.effectiveAt || "2026-10-12"} />
      <Text style={review.note}>{fixture.population
        ? `${sample?"REVIEW DRAFT — NOT FOR CUSTOMER SIGNATURE. SAMPLE DATA: fictional customer, rental, and recorded evidence from a local snapshot fixture. All dates, amounts, contacts, and evidence examples are sample data.":"REVIEW DRAFT — NOT FOR CUSTOMER SIGNATURE. Details come from the supplied persisted Agreement snapshot."} Existing snapshot fields populate supported details; unresolved fields are marked. Acceptance and authorization evidence belongs to the stored Agreement only, not Jason’s proposed terms. No signature or lessor execution is represented. Jason’s source reference prices, deposits, and legal-policy conflicts remain unresolved.`
        : "REVIEW DRAFT — NOT FOR CUSTOMER SIGNATURE. Source: Jason’s 18-page Rental Agreement for Alex to view.pdf. Source wording, placeholders, duplicate text, equipment identifiers and amounts are retained for comparison, except the Schedule 1 omissions identified in the accompanying report. No sample renter, transaction, approval, or signature is represented."}</Text>
      {fixture.blocks.map((block: any,index: number) => {
        if(block.kind==="section") return <View key={index} style={{marginTop:8,marginBottom:10}} minPresenceAhead={fixture.population&&["EXHIBIT C","EXHIBIT D"].includes(block.title)?180:80} wrap={false}>
          <Text style={styles.sectionTitle}>{block.title}</Text>
          <Text style={styles.clauseTitle}>{block.subtitle}</Text>
        </View>;
        if(block.kind==="notice") return <Text key={index} style={review.note}>{block.text}</Text>;
        if(block.kind==="details") return <View key={index} style={styles.section} wrap={false}>
          <Text style={styles.sectionTitle}>{block.title}</Text>
          <View style={styles.twoColumn}>{[0,1].map(column=><View key={column} style={styles.column}>
            {block.rows.filter((_row: any,r: number)=>r%2===column).map(([label,value]: string[],r: number)=><View key={r} style={styles.detailRow}>
              <Text style={styles.detailLabel}>{label}</Text><Text style={value.startsWith("sha256:")?{...styles.detailValue,fontSize:6.2}:styles.detailValue}>{value.startsWith("sha256:")?value.match(/.{1,20}/g)?.join("\n"):value}</Text>
            </View>)}
          </View>)}</View>
        </View>;
        if(block.kind==="transactionItems") return <View key={index} style={styles.section} wrap={false}>
          <Text style={styles.sectionTitle}>{block.title}</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>{["Equipment","Serial / VIN","Rental period","Qty","Daily rate","Days","Amount"].map((label,c)=><Text key={c} style={[styles.cell,{width:`${[26,14,22,6,12,6,14][c]}%`}]}>{label}</Text>)}</View>
            {block.rows.map((row: string[],r: number)=><View key={r} style={styles.tableRow} wrap={false}>{row.map((value,c)=><Text key={c} style={[styles.cell,{width:`${[26,14,22,6,12,6,14][c]}%`,textAlign:c>=3?"right":"left"}]}>{c===1&&!value.startsWith("[UNRESOLVED")?value.match(/.{1,6}/g)?.join("\n"):value}</Text>)}</View>)}
          </View>
          {block.notes.map((note: string,r: number)=><Text key={r} style={{...styles.equipmentNotes,marginTop:4}}>Stored item note: {note}</Text>)}
        </View>;
        if(block.kind==="financials") return <View key={index} style={styles.section} wrap={false}>
          <Text style={styles.sectionTitle}>{block.title}</Text><View style={styles.financials}>{block.rows.map(([label,value]: string[],r: number)=><View key={r} style={r===block.rows.length-1?[styles.financialRow,styles.totalRow]:styles.financialRow}>
            <Text style={styles.financialLabel}>{label}</Text><Text style={styles.financialValue}>{value}</Text>
          </View>)}</View>
        </View>;
        if(block.kind==="table") return <View key={index} style={[styles.table,review.table]} wrap={!fixture.population}>
          {block.rows.map((row: string[],r: number)=><View key={r} style={r===0?styles.tableHeader:styles.tableRow} wrap={false}>
            {row.map((cell,c)=><Text key={c} style={[styles.cell,{width:`${block.widths[c]}%`,textAlign:c>0&&block.rows[0][c].includes("Rate")?"right":"left"}]}>{cell}</Text>)}
          </View>)}
        </View>;
        if(block.kind==="field") {
          const signature=/Signature:|Representative:|^By:/.test(block.text);
          return <View key={index} wrap={false} style={signature ? {...styles.signatureLine,marginTop:10,marginBottom:6} : {}}><Text style={review.field}>{block.text.replaceAll("☐","[ ]")}</Text></View>;
        }
        // Match source numbered section starts without changing or relocating words.
        const numbered=/^\d+\.(?:\d+[A-Z]?)?\s/.test(block.text);
        const shortHeading=block.text.length<130 && (/^[A-Z /-]+$/.test(block.text)||block.text==="Authorization"||block.text==="Security Deposit Disclosure"||block.text==="[Signature Page to Equipment Lease]"||(numbered&&(/^\d+\.(?:\d+[A-Z]?)?\s[^.]+\.$/.test(block.text)||block.text===block.text.toUpperCase())));
        return <View key={index} style={{marginBottom:7}} minPresenceAhead={shortHeading?80:0} wrap={!shortHeading}><Text style={shortHeading?{...styles.clauseTitle,marginTop:8,marginBottom:5}:styles.clauseBody} orphans={3} widows={3}>
          {numbered?<><Text style={{fontFamily:"Helvetica",fontWeight:"bold"}}>{block.text.match(/^\d+\.(?:\d+[A-Z]?)?\s/)[0]}</Text>{block.text.replace(/^\d+\.(?:\d+[A-Z]?)?\s/,"")}</>:block.text}
        </Text></View>;
      })}
    </Page>
  </Document>;
}
