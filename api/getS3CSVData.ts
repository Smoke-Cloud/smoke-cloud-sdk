export interface DataVector<X, Y> {
  values: {
    x: X;
    y: Y;
  }[];
  x_units: string;
  x_name: string;
  y_units: string;
  y_name: string;
}

export interface RunData {
  start_time?: number;
  end_time?: number;
  time_steps: DataVector<number, string>;
}

export function csvArrToVecs(
  arr: string[][],
  value: string,
): DataVector<number, number> | undefined {
  const nameArray = arr[1];
  // find the index of "Time"
  const timeIndex = nameArray.indexOf("Time");
  // find the index of value
  const valueIndex = nameArray.indexOf(value);
  if (valueIndex < 0) return;
  let values: {
    x: number;
    y: number;
  }[] = [];
  let x_units = arr[0][timeIndex];
  let x_name = arr[1][timeIndex];

  let y_units = arr[0][valueIndex];
  let y_name = arr[1][valueIndex];
  for (let i = 0; i < arr.length; i++) {
    let val: {
      x: number;
      y: number;
    } = {
      "x": parseFloat(arr[i][timeIndex]),
      "y": parseFloat(arr[i][valueIndex]),
    };
    values.push(val);
  }
  if (x_name && x_units && y_name && y_units && values) {
    return { values, x_units, x_name, y_units, y_name };
  } else {
    return;
  }
}

// ref: http://stackoverflow.com/a/1293163/2343
// This will parse a delimited string into an array of
// arrays. The default delimiter is the comma, but this
// can be overriden in the second argument.
export function csvToArray(strData: string, strDelimiter: string): string[][] {
  // Check to see if the delimiter is defined. If not,
  // then default to comma.
  strDelimiter = strDelimiter || ",";

  // Create a regular expression to parse the CSV values.
  var objPattern = new RegExp(
    (
      // Delimiters.
      "(\\" + strDelimiter + "|\\r?\\n|\\r|^)" +
      // Quoted fields.
      '(?:"([^"]*(?:""[^"]*)*)"|' +
      // Standard fields.
      '([^"\\' + strDelimiter + "\\r\\n]*))"
    ),
    "gi",
  );

  // Create an array to hold our data. Give the array
  // a default empty first row.
  var arrData: string[][] = [[]];

  // Create an array to hold our individual pattern
  // matching groups.
  var arrMatches = null;

  // Keep looping over the regular expression matches
  // until we can no longer find a match.
  while (arrMatches = objPattern.exec(strData)) {
    // Get the delimiter that was found.
    var strMatchedDelimiter = arrMatches[1];

    // Check to see if the given delimiter has a length
    // (is not the start of string) and if it matches
    // field delimiter. If id does not, then we know
    // that this delimiter is a row delimiter.
    if (
      strMatchedDelimiter.length &&
      strMatchedDelimiter !== strDelimiter
    ) {
      // Since we have reached a new row of data,
      // add an empty row to our data array.
      arrData.push([]);
    }

    var strMatchedValue;

    // Now that we have our delimiter out of the way,
    // let"s check to see which kind of value we
    // captured (quoted or unquoted).
    if (arrMatches[2]) {
      // We found a quoted value. When we capture
      // this value, unescape any double quotes.
      strMatchedValue = arrMatches[2].replace(
        new RegExp('""', "g"),
        '"',
      );
    } else {
      // We found a non-quoted value.
      strMatchedValue = arrMatches[3];
    }

    // Now that we have our value string, let"s add
    // it to the data array.
    arrData[arrData.length - 1].push(strMatchedValue);
  }

  // Return the parsed data.
  return arrData;
}
