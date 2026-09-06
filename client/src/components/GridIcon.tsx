interface GridIconProps {
  completions?: Record<
    number,
    {
      completedAt: string;
    }
  >;
  className?: string;
}

const GridIcon = (props: GridIconProps) => {
  const { completions } = props;

  return (
    <div className={`grid-icon${props.className ? ` ${props.className}` : ""}`}>
      <div className="grid-icon-row">
        <div
          title="January"
          className={`grid-icon-cell${completions?.[0] ? " completed" : ""}`}
        >
          J
        </div>
        <div
          title="February"
          className={`grid-icon-cell${completions?.[1] ? " completed" : ""}`}
        >
          F
        </div>
        <div
          title="March"
          className={`grid-icon-cell${completions?.[2] ? " completed" : ""}`}
        >
          M
        </div>
        <div
          title="April"
          className={`grid-icon-cell${completions?.[3] ? " completed" : ""}`}
        >
          A
        </div>
      </div>
      <div className="grid-icon-row">
        <div
          title="May"
          className={`grid-icon-cell${completions?.[4] ? " completed" : ""}`}
        >
          M
        </div>
        <div
          title="June"
          className={`grid-icon-cell${completions?.[5] ? " completed" : ""}`}
        >
          J
        </div>
        <div
          title="July"
          className={`grid-icon-cell${completions?.[6] ? " completed" : ""}`}
        >
          J
        </div>
        <div
          title="August"
          className={`grid-icon-cell${completions?.[7] ? " completed" : ""}`}
        >
          A
        </div>
      </div>
      <div className="grid-icon-row">
        <div
          title="September"
          className={`grid-icon-cell${completions?.[8] ? " completed" : ""}`}
        >
          S
        </div>
        <div
          title="October"
          className={`grid-icon-cell${completions?.[9] ? " completed" : ""}`}
        >
          O
        </div>
        <div
          title="November"
          className={`grid-icon-cell${completions?.[10] ? " completed" : ""}`}
        >
          N
        </div>
        <div
          title="December"
          className={`grid-icon-cell${completions?.[11] ? " completed" : ""}`}
        >
          D
        </div>
      </div>
    </div>
  );
};

export default GridIcon;
