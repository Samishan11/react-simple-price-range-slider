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

## Usage

Here's an example of how you can use react-multi-input-rangeslider in your React application:

```js
import React, { useState } from "react";
import MultiInputSlider from "react-multi-input-rangeslider";
import "react-multi-input-rangeslider/style.style.css"

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
```

## Props

<table>
<tr>
    <th>Property</th>
    <th>Type</th>
    <th>Default Value</th>
    <th>Description</th>
</tr>

<tr>
    <td><code>min</code></td>
    <td>number</td>
    <td>0</td>
    <td>Specifies the lowest value in the range of permitted values. Its value must be less than that of <code>max</code>.</td>
</tr>
<tr>
    <td><code>max</code></td>
    <td>number</td>
    <td>100</td>
    <td>Specifies the greatest value in the range of permitted values. Its value must be greater than that of <code>min</code>.</td>
</tr>
<tr>
    <td><code>disabled</code></td>
    <td>boolean</td>
    <td>false</td>
    <td>Specifies whether the range slider element is disabled or not.</td>
</tr>
<tr>
    <td><code>onChange</code></td>
    <td>function</td>
    <td>NOOP</td>
    <td>Specifies a function to be called when the slide event is triggered for any of the thumbs.</td>
</tr>
<tr>
    <td><code>rangeColor</code></td>
    <td>string</td>
    <td>color</td>
    <td>Specifies the color for the range.</td>
</tr>
<tr>
    <td><code>trackColor</code></td>
    <td>string</td>
    <td>color</td>
    <td>Specifies the color for the track.</td>
</tr>
</table>
