# react-multi-input-rangeslider

`react-multi-input-rangeslider` is a highly customizable and easy-to-use React component that allows users to select a range of values within a specified minimum and maximum range. This component is particularly useful for applications that require a user to specify price ranges, filter ranges, or any other numeric range input. It is built with TypeScript and designed to be flexible and easy to integrate into any React application.

## Features

- Customizable track and range colors
- Adjustable thumb size
- Supports minimum and maximum values
- Built with TypeScript

## Installation

You can install `react-multi-input-rangeslider` using npm or yarn:

```sh
npm install react-multi-input-rangeslider
OR
yarn add react-multi-input-rangeslider

```

```sh
#Usage

Here's an example of how you can use react-multi-input-rangeslider in your React application:

import React, { useState } from "react";
import MultiInputSlider from "react-multi-input-rangeslider";

const App = () => {
  const [price, setPrice] = useState<{ minPrice: number; maxPrice: number }>({
    minPrice: 0,
    maxPrice: 0,
  });

  return (
    <MultiInputSlider
      min={0}
      max={1000}
      onChange={({ min, max }) => setPrice({ minPrice: min, maxPrice: max })}
    />
  );
};

export default App;

In this example, the MultiInputSlider component is used to allow users to select a range of values.

```

# Props

```sh
`Type`: Number
`defaultValue` Value: [0,100]
`Optional`: No
`min` Number: 0
`max` Number :0
`onChange`: function
```
