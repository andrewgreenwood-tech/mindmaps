/* =========================================================
   MIND MAP GENERATOR
   Version 3 — Real Expand / Collapse
========================================================= */


/* ---------------------------------------------------------
   DOM
--------------------------------------------------------- */

const markdownInput =
    document.getElementById("markdownInput");

const generateButton =
    document.getElementById("generateButton");

const imageInput =
    document.getElementById("imageInput");

const imagePreview =
    document.getElementById("imagePreview");

const inputPanel =
    document.getElementById("inputPanel");

const mapPanel =
    document.getElementById("mapPanel");

const svg =
    d3.select("#mindMap");


/* ---------------------------------------------------------
   STATE
--------------------------------------------------------- */

let root = null;
let zoomBehaviour = null;
let currentImage = null;


/* =========================================================
   IMAGE HANDLING
========================================================= */

imageInput.addEventListener("change", function () {

    const file = this.files[0];

    if (!file) {

        currentImage = null;

        imagePreview.style.display = "none";
        imagePreview.innerHTML = "";

        return;
    }


    const reader = new FileReader();

    reader.onload = function (event) {

        currentImage = event.target.result;

        imagePreview.innerHTML =
            `<img src="${currentImage}" alt="Map image">`;

        imagePreview.style.display = "block";
    };

    reader.readAsDataURL(file);
});


/* =========================================================
   MARKDOWN PARSER
========================================================= */

function parseMarkdown(markdown) {

    const lines =
        markdown
            .replace(/\r\n/g, "\n")
            .split("\n");


    let root = null;

    const stack = [];


    for (let rawLine of lines) {

        const line =
            rawLine.replace(/\t/g, "    ");


        if (!line.trim()) {
            continue;
        }


        /* ---------------------------------------------
           Heading
        --------------------------------------------- */

        const headingMatch =
            line.match(/^(#{1,6})\s+(.+)$/);


        if (headingMatch) {

            const level =
                headingMatch[1].length;

            const title =
                headingMatch[2].trim();


            const node = {

                title: title,

                level: level,

                type: "heading",

                children: [],

                collapsed: false

            };


            /* -----------------------------------------
               Root
            ----------------------------------------- */

            if (level === 1 || !root) {

                if (!root) {
                    root = node;
                }

                stack.length = 0;

                stack.push(node);

                continue;
            }


            /* -----------------------------------------
               Find parent
            ----------------------------------------- */

            while (
                stack.length > 0 &&
                stack[stack.length - 1].level >= level
            ) {

                stack.pop();
            }


            const parent =
                stack[stack.length - 1];


            if (parent) {

                parent.children.push(node);

                stack.push(node);
            }


            continue;
        }


        /* ---------------------------------------------
           Bullet
        --------------------------------------------- */

        const bulletMatch =
            line.match(/^\s*[-*+]\s+(.+)$/);


        if (bulletMatch) {

            const node = {

                title: bulletMatch[1].trim(),

                level: null,

                type: "detail",

                children: [],

                collapsed: false

            };


            const parent =
                stack[stack.length - 1];


            if (parent) {

                parent.children.push(node);
            }
        }
    }


    return root;
}


/* =========================================================
   BRANCH COLOR
========================================================= */

function branchColor(node) {

    const colors = [

        "#3977c9",
        "#4f9a5a",
        "#d99427",
        "#8757a8",
        "#c45b5b",
        "#328f8f"

    ];


    let branch = node;


    while (
        branch.parent &&
        branch.parent.depth > 0
    ) {

        branch = branch.parent;
    }


    if (
        branch.parent &&
        branch.parent.children
    ) {

        const index =
            branch.parent.children.indexOf(branch);

        return colors[
            index % colors.length
        ];
    }


    return colors[0];
}


/* =========================================================
   RENDER MIND MAP
========================================================= */

function renderMindMap(tree, fitAfterRender = false) {

    svg.selectAll("*").remove();


    if (!tree) {
        return;
    }


    const width =
        svg.node().clientWidth;

    const height =
        svg.node().clientHeight;


    /* ---------------------------------------------
       Main container
    --------------------------------------------- */

    const container =
        svg.append("g")
            .attr("class", "map-container");


    /* ---------------------------------------------
       Zoom
    --------------------------------------------- */

    zoomBehaviour =
        d3.zoom()

            .scaleExtent([0.25, 3])

            .on("zoom", event => {

                container.attr(
                    "transform",
                    event.transform
                );

            });


    svg.call(zoomBehaviour);


    /* =================================================
       IMPORTANT:
       D3 only creates children when the node is open.
    ================================================= */

    root =
        d3.hierarchy(
            tree,
            node => {

                if (node.collapsed) {
                    return null;
                }

                return node.children;
            }
        );


    /* ---------------------------------------------
       Tree layout
    --------------------------------------------- */

    const layout =
        d3.tree()
            .nodeSize([75, 230]);


    layout(root);


    const xOffset =
        width / 2;

    const yOffset =
        height / 2;


    /* =================================================
       LINKS
    ================================================= */

    const linkGroup =
        container
            .append("g")
            .attr("class", "links");


    linkGroup
        .selectAll("path")
        .data(root.links())
        .join("path")

        .attr(
            "fill",
            "none"
        )

        .attr(
            "stroke",
            d => {

                if (d.target.depth === 1) {
                    return branchColor(d.target);
                }

                return "#b8b8b8";
            }
        )

        .attr(
            "stroke-width",
            d => {

                if (d.target.depth === 1) {
                    return 4;
                }

                if (d.target.depth === 2) {
                    return 2.5;
                }

                return 1.5;
            }
        )

        .attr(
            "stroke-linecap",
            "round"
        )

        .attr(
            "d",
            d3.linkHorizontal()
                .x(d => d.y + xOffset)
                .y(d => d.x + yOffset)
        );


    /* =================================================
       NODES
    ================================================= */

    const nodeGroup =
        container
            .append("g")
            .attr("class", "nodes");


    const nodes =
        nodeGroup
            .selectAll("g")
            .data(root.descendants())
            .join("g")

            .attr(
                "class",
                "mind-node"
            )

            .attr(
                "transform",
                d =>
                    `translate(
                        ${d.y + xOffset},
                        ${d.x + yOffset}
                    )`
            );


    /* =================================================
       NODE CIRCLE
    ================================================= */

    nodes
        .append("circle")

        .attr(
            "r",
            d => {

                if (d.depth === 0) {
                    return 11;
                }

                if (d.depth === 1) {
                    return 8;
                }

                return 5;
            }
        )

        .attr(
            "fill",
            d => {

                if (d.depth === 0) {
                    return "#20242a";
                }

                if (d.depth === 1) {
                    return branchColor(d);
                }

                return "#777";
            }
        )

        .attr(
            "stroke",
            "white"
        )

        .attr(
            "stroke-width",
            2
        );


    /* =================================================
       EXPAND / COLLAPSE CONTROL
    ================================================= */

    const expandable =
        nodes.filter(
            d =>
                d.data.children &&
                d.data.children.length > 0
        );


    /* ---------------------------------------------
       Control circle
    --------------------------------------------- */

    expandable

        .append("circle")

        .attr(
            "class",
            "expand-button"
        )

        .attr(
            "cx",
            0
        )

        .attr(
            "cy",
            0
        )

        .attr(
            "r",
            13
        )

        .attr(
            "fill",
            "white"
        )

        .attr(
            "stroke",
            d => branchColor(d)
        )

        .attr(
            "stroke-width",
            2
        );


    /* ---------------------------------------------
       Plus / minus symbol
    --------------------------------------------- */

    expandable

        .append("text")

        .attr(
            "class",
            "expand-symbol"
        )

        .attr(
            "x",
            0
        )

        .attr(
            "y",
            1
        )

        .attr(
            "text-anchor",
            "middle"
        )

        .attr(
            "dominant-baseline",
            "middle"
        )

        .attr(
            "font-size",
            "13px"
        )

        .attr(
            "font-weight",
            "700"
        )

        .attr(
            "fill",
            d => branchColor(d)
        )

        .text(
            d =>
                d.data.collapsed
                    ? "+"
                    : "−"
        );


    /* =================================================
       TEXT
    ================================================= */

    nodes

        .append("text")

        .attr(
            "class",
            d => {

                if (d.depth === 0) {
                    return "node-title";
                }

                if (
                    d.data.type === "detail"
                ) {
                    return "node-detail";
                }

                return "node-title";
            }
        )

        .attr(
            "x",
            d => {

                if (
                    d.data.children &&
                    d.data.children.length > 0
                ) {

                    return 24;
                }

                return 17;
            }
        )

        .attr(
            "dy",
            "0.35em"
        )

        .attr(
            "font-size",
            d => {

                if (d.depth === 0) {
                    return "24px";
                }

                if (d.depth === 1) {
                    return "17px";
                }

                if (d.depth === 2) {
                    return "14px";
                }

                return "12px";
            }
        )

        .text(
            d =>
                d.data.title
        );


    /* =================================================
       ROOT IMAGE
    ================================================= */

    if (currentImage) {

        const rootNode =
            nodes.filter(
                d =>
                    d.depth === 0
            );


        rootNode

            .append("image")

            .attr(
                "href",
                currentImage
            )

            .attr(
                "x",
                -75
            )

            .attr(
                "y",
                -105
            )

            .attr(
                "width",
                150
            )

            .attr(
                "height",
                75
            )

            .attr(
                "preserveAspectRatio",
                "xMidYMid slice"
            );
    }


    /* =================================================
       CLICK TO EXPAND / COLLAPSE
    ================================================= */

    expandable.on(
        "click",
        function(event, d) {

            event.stopPropagation();


            /* Toggle the actual data node */

            d.data.collapsed =
                !d.data.collapsed;


            /* Re-render without changing zoom */

            renderMindMap(tree, false);
        }
    );


    /* =================================================
       FIT
    ================================================= */

   if (fitAfterRender) {
    setTimeout(
        fitMap,
        50
    );
}
}


/* =========================================================
   FIT MAP
========================================================= */

function fitMap() {

    if (!root) {
        return;
    }


    const container =
        d3.select(
            "#mindMap .map-container"
        );


    if (!container.node()) {
        return;
    }


    const bounds =
        container
            .node()
            .getBBox();


    const width =
        svg.node().clientWidth;

    const height =
        svg.node().clientHeight;


    const scale =
        Math.min(

            width /
            (bounds.width + 180),

            height /
            (bounds.height + 180),

            1

        );


    const x =
        width / 2 -
        scale *
        (
            bounds.x +
            bounds.width / 2
        );


    const y =
        height / 2 -
        scale *
        (
            bounds.y +
            bounds.height / 2
        );


    svg.transition()

        .duration(400)

        .call(
            zoomBehaviour.transform,
            d3.zoomIdentity
                .translate(x, y)
                .scale(scale)
        );
}


/* =========================================================
   ZOOM BUTTONS
========================================================= */

document
    .getElementById("zoomInButton")
    .addEventListener(
        "click",
        () => {

            svg.transition()
                .call(
                    zoomBehaviour.scaleBy,
                    1.25
                );
        }
    );


document
    .getElementById("zoomOutButton")
    .addEventListener(
        "click",
        () => {

            svg.transition()
                .call(
                    zoomBehaviour.scaleBy,
                    0.8
                );
        }
    );


document
    .getElementById("fitButton")
    .addEventListener(
        "click",
        fitMap
    );


/* =========================================================
   GENERATE BUTTON
========================================================= */

generateButton.addEventListener(
    "click",
    () => {

        const markdown =
            markdownInput.value.trim();


        if (!markdown) {

            alert(
                "Please enter a Markdown mind map first."
            );

            return;
        }


        const tree =
            parseMarkdown(markdown);


        if (!tree) {

            alert(
                "The Markdown could not be interpreted."
            );

            return;
        }


        inputPanel.classList.add(
            "hidden"
        );


        mapPanel.classList.remove(
            "hidden"
        );


        renderMindMap(tree true);
    }
);
