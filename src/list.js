{/* <custom-list>
<li>List item 1</li>
</custom-list>

<style>
    custom-list:not(:defined) {
      display: none;
    }
  </style> */}

class CustomList extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    const template = document.createElement('template');
    template.innerHTML = `
      <style>
        /* This rule makes the component visible once it's defined, overriding the style in the HTML head */
        :host {
          display: block;
          font-family: sans-serif;
          border: 1px solid #ccc;
          border-radius: 5px;
          padding: 1rem;
        }
        ul {
          list-style-type: "✅ ";
          padding-left: 1.5rem;
          margin: 0;
        }

        /* --- NEW RULE --- */
        /* This styles the <li> elements slotted from the main HTML */
        ::slotted(li) {
          color: red;
        }
      </style>
      
      <ul>
        <slot></slot>
      </ul>
    `;

    this.shadowRoot.appendChild(template.content.cloneNode(true));
  }
}

if (window.circleUser) {
    const user = window.circleUser || {};
    if ('publicUid' in user) {
        if (user.publicUid === 'e9e4f2fe' || user.publicUid === '5ed18cd5') {

        }
    }
}

//  <custom-list> tag
customElements.define('custom-list', CustomList);
console.log('log for custom list');