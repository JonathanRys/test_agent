export interface GridIconProps {
  completions?: Record<
    number,
    Array<{
      completedAt: string;
    }>
  >;
  className?: string;
}

const GridIcon = (props: GridIconProps) => {
  const { completions } = props;
  const monthTitle = (month: number, name: string) =>
    completions?.[month]?.length
      ? `${name}: ${completions[month].map((completion) => completion.completedAt.slice(0, 10)).join(", ")}`
      : name;

  return (
    <div className={`grid-icon${props.className ? ` ${props.className}` : ""}`}>
      <div className="grid-icon-row">
        <div
          title={monthTitle(0, "January")}
          className={`grid-icon-cell${completions?.[0]?.length ? " completed" : ""}`}
        >
          J
        </div>
        <div
          title={monthTitle(1, "February")}
          className={`grid-icon-cell${completions?.[1]?.length ? " completed" : ""}`}
        >
          F
        </div>
        <div
          title={monthTitle(2, "March")}
          className={`grid-icon-cell${completions?.[2]?.length ? " completed" : ""}`}
        >
          M
        </div>
        <div
          title={monthTitle(3, "April")}
          className={`grid-icon-cell${completions?.[3]?.length ? " completed" : ""}`}
        >
          A
        </div>
      </div>
      <div className="grid-icon-row">
        <div
          title={monthTitle(4, "May")}
          className={`grid-icon-cell${completions?.[4]?.length ? " completed" : ""}`}
        >
          M
        </div>
        <div
          title={monthTitle(5, "June")}
          className={`grid-icon-cell${completions?.[5]?.length ? " completed" : ""}`}
        >
          J
        </div>
        <div
          title={monthTitle(6, "July")}
          className={`grid-icon-cell${completions?.[6]?.length ? " completed" : ""}`}
        >
          J
        </div>
        <div
          title={monthTitle(7, "August")}
          className={`grid-icon-cell${completions?.[7]?.length ? " completed" : ""}`}
        >
          A
        </div>
      </div>
      <div className="grid-icon-row">
        <div
          title={monthTitle(8, "September")}
          className={`grid-icon-cell${completions?.[8]?.length ? " completed" : ""}`}
        >
          S
        </div>
        <div
          title={monthTitle(9, "October")}
          className={`grid-icon-cell${completions?.[9]?.length ? " completed" : ""}`}
        >
          O
        </div>
        <div
          title={monthTitle(10, "November")}
          className={`grid-icon-cell${completions?.[10]?.length ? " completed" : ""}`}
        >
          N
        </div>
        <div
          title={monthTitle(11, "December")}
          className={`grid-icon-cell${completions?.[11]?.length ? " completed" : ""}`}
        >
          D
        </div>
      </div>
    </div>
  );
};

export default GridIcon;
