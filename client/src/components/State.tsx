import { SVGProps } from "react";
import {
  AL,
  AK,
  AZ,
  AR,
  CA,
  CO,
  CT,
  DE,
  FL,
  GA,
  HI,
  ID,
  IL,
  IN,
  IA,
  KS,
  KY,
  LA,
  ME,
  MD,
  MA,
  MI,
  MN,
  MS,
  MO,
  MT,
  NE,
  NV,
  NH,
  NJ,
  NM,
  NY,
  NC,
  ND,
  OH,
  OK,
  OR,
  PA,
  RI,
  SC,
  SD,
  TN,
  TX,
  UT,
  VT,
  VA,
  WA,
  WV,
  WI,
  WY,
} from "@state-icons/react";

// 1. Define the lookup mapping
const stateComponents: Record<string, React.ComponentType<any>> = {
  AL: AL,
  AK: AK,
  AZ: AZ,
  AR: AR,
  CA: CA,
  CO: CO,
  CT: CT,
  DE: DE,
  FL: FL,
  GA: GA,
  HI: HI,
  ID: ID,
  IL: IL,
  IN: IN,
  IA: IA,
  KS: KS,
  KY: KY,
  LA: LA,
  ME: ME,
  MD: MD,
  MA: MA,
  MI: MI,
  MN: MN,
  MS: MS,
  MO: MO,
  MT: MT,
  NE: NE,
  NV: NV,
  NH: NH,
  NJ: NJ,
  NM: NM,
  NY: NY,
  NC: NC,
  ND: ND,
  OH: OH,
  OK: OK,
  OR: OR,
  PA: PA,
  RI: RI,
  SC: SC,
  SD: SD,
  TN: TN,
  TX: TX,
  UT: UT,
  VT: VT,
  VA: VA,
  WA: WA,
  WV: WV,
  WI: WI,
  WY: WY,
};

// 2. Define the wrapper component props
interface StateIconProps extends SVGProps<SVGSVGElement> {
  state: string;
  size?: number | string;
  color?: string;
}

// 3. Export the flexible wrapper
export default function StateIcon({ state, ...props }: StateIconProps) {
  // Ensure we match uppercase abbreviations
  const upperState = state.toUpperCase();
  const IconComponent = stateComponents[upperState];

  if (!IconComponent) {
    console.warn(
      `State code "${state}" not found in @state-icons/react mapping.`,
    );
    return null;
  }

  return <IconComponent {...props} />;
}
