import ReactDOM from "react-dom";
import React, { useRef, useState, useEffect } from "react";
import useDimensions from "react-cool-dimensions";
import blocks from "./blocks";
import CustomStyle, { styleMetadata } from "./CustomStyle";
import Sidebar from "./components/Sidebar";
import { proxy, useProxy } from "valtio";
import { Surface } from "gl-react-dom";

const store = proxy({
  ...styleMetadata
});

/*
  Wrapped Component required to make gl-react demos compatible with EthBlock.art
  As a creative coder, you can ignore this file, check CustomStyle.js
*/
function App() {
  const [blockNumber, setBlockNumber] = useState(1);
  const snap = useProxy(store);
  const attributesRef = useRef();
  const { ref, width, height } = useDimensions({});

  const [time, setTime] = useState(0);
  useEffect(() => {
    let startT;
    let h;
    function loop(t) {
      h = requestAnimationFrame(loop);
      if (!startT) startT = t;
      setTime((t - startT) / 1000);
    }

    h = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(h);
  }, []);

  const mods = Object.keys(store.options).map((k) => {
    return {
      key: k,
      value: snap.options[k],
      set: (v) => {
        store.options[k] = v;
      }
    };
  });

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <div style={{ flexGrow: 1 }}>
        <div
          ref={ref}
          style={{
            margin: "0 auto",
            marginTop: "64px",
            width: "60vw",
            height: "60vw"
          }}
        >
          <h3>EthBlock.art gl-react boilerplate</h3>
          {width && height ? (
            <Surface width={width} height={height}>
              <CustomStyle
                width={width}
                block={blocks[blockNumber]}
                height={height}
                time={time}
                attributesRef={attributesRef}
                {...snap.options}
              />
            </Surface>
          ) : null}
        </div>
      </div>

      <Sidebar
        blocks={blocks}
        blockNumber={blockNumber}
        attributes={attributesRef.current || {}}
        mods={mods}
        handleBlockChange={(e) => setBlockNumber(e)}
      />
    </div>
  );
}

// export default App;

ReactDOM.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  document.getElementById("root")
);
