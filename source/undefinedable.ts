export const undefinedable = <ValueType, ResultType>(target: (value: ValueType) => ResultType) =>
    (value: ValueType | undefined): ResultType | undefined =>
        undefined === value ? undefined : target(value);
