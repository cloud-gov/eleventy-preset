---
page_heading: Context heading
---
{% assign assigned_before_accordion = "Outer assignment" %}
{% uswds_accordion bordered=true %}
items:
  - title: "{{ page_heading }}"
    content: |-
      {% assign item_only = "first" %}
      **{% site_notice page_heading, item_only %}**
      {{ assigned_before_accordion }}
      {% uswds_icon "check", "test-icon" %}
  - title: Second
    content: |-
      {{ item_only | default: "isolated" }}
      {% site_notice page_heading, "second" %}
      {% liquid_notice page_heading %}
      {% emit_liquid %}
{% enduswds_accordion %}
