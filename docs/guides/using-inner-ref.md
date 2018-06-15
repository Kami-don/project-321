# Using `innerRef`

> If you have not used `ref`'s before, please take a look at the [`React`: Refs and the DOM guide](https://reactjs.org/docs/refs-and-the-dom.html) on their documentation website.

Our `Draggable` and `Droppable` components both require a *DOM node* to be provided to them. This is done using the `innerRef` property on the `DraggableProvided` and `DroppableProvided` objects.

```diff
<Draggable draggableId="draggable-1" index={0}>
  {(provided, snapshot) => (
    <div
+      ref={provided.innerRef}
      {...provided.draggableProps}
      {...provided.dragHandleProps}
    >
      <h4>My draggable</h4>
    </div>
  )}
</Draggable>;
```

```diff
<Droppable droppableId="droppable-1">
  {(provided, snapshot) => (
    <div
+     ref={provided.innerRef}
      {...provided.droppableProps}
    >
      <h2>I am a droppable!</h2>
      {provided.placeholder}
    </div>
  )}
</Droppable>;
```

## Not all `ref`s are created equal

Confusion can arise because of how the `ref` callback works in `React`.

On a *Component* such as `<Person />` the `ref` callback will return the *instance* of the `Person` component.

On a *Element* such as `<div />` the `ref` callback will return the *DOM node* that the *Element* is tied to.

[See on `codesandbox.io`](https://codesandbox.io/s/xok96ovo8p)

```js
class Person extends React.Component {
  state = {
    sayHello: false,
  };
  sayHello() {
    this.setState({
      sayHello: true,
    });
  }
  render() {
    if (this.state.sayHello) {
      return <div {...this.props}>Hello</div>;
    }

    return <div {...this.props}>'I am a person, I think..'</div>;
  }
}

class App extends React.Component {
  setPersonRef = ref => {
    this.personRef = ref;

    // When the ref changes it will firstly be set to null
    if (this.personRef) {
      // personRef is an instance of the Person class
      this.personRef.sayHello();
    }
  };
  setDivRef = ref => {
    this.divRef = ref;

    if (this.divRef) {
      // div ref is a HTMLElement
      this.divRef.style.backgroundColor = 'lightgreen';
    }
  };
  render() {
    return (
      <React.Fragment>
        <Person ref={this.setPersonRef} />
        <div ref={this.setDivRef}>hi there</div>
      </React.Fragment>
    );
  }
}
```

## A common error 🐞

Take a look at this example:

```js
<Draggable draggableId="draggable-1" index={0}>
  {(provided, snapshot) => (
    <Person
      ref={provided.innerRef}
      {...provided.draggableProps}
      {...provided.dragHandleProps}
    >
      <h4>My draggable</h4>
    </div>
  )}
</Draggable>
```

While it looks correct, it **will cause your application to explode 💥!**

This is because `react-beautiful-dnd` expects the `provided.innerRef` function for a `Draggable` and a `Droppable` to be called with the DOM node of the component, and not the *instance* of the class. In this example we are calling `provided.innerRef` with an *instance* of `Person` and not the underlying DOM node.

## Exposing a DOM ref from your Component 🤩

A simple way to expose the *DOM node* of your component is to **create your own `innerRef` prop**:

```js
class Person extends React.Component {
  render() {
    return (
      <div {...this.props} ref={this.props.innerRef}>
        I am a person, I think..
      </div>
    );
  }
}
```

You can then correctly supply the DOM node to a `Draggable` or `Droppable`

```diff
<Draggable draggableId="draggable-1" index={0}>
  {(provided, snapshot) => (
    <Person
-      ref={provided.innerRef}
+      innerRef={provided.innerRef}
      {...provided.draggableProps}
      {...provided.dragHandleProps}
    >
      <h4>My draggable</h4>
    </div>
  )}
</Draggable>
```

If you also need to use the *DOM node* within your *Component* you can have a more powerful ref setting approach:

```js
class Person extends React.Component {
  setRef = ref => {
    // keep a reference to the ref as an instance property
    this.ref = ref;
    // give the ref to react-beautiful-dnd
    this.props.innerRef(ref);
  };
  render() {
    return (
      <div {...this.props} ref={this.setRef}>
        I am a person, I think..
      </div>
    );
  }
}
```

## Putting it all together

Here is an example that shows off the learnings presented in this guide: https://codesandbox.io/s/v3p0q71qn5

> Note, the name `innerRef` is just a convention. You could call it whatever you want for your component. Something like `domRef` is fine.
