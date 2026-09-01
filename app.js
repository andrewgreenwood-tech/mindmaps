/* =========================================================
   MIND MAP GENERATOR
   Version 5 — Card Style Visual Map
========================================================= */


/* =========================================================
   DOM
========================================================= */

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


/* =========================================================
   STATE
========================================================= */

let root = null;

let zoomBehaviour = null;

let currentImage = null;


/* =========================================================
   IMAGE HANDLING
========================================================= */

imageInput.addEventListener(
    "change",
    function () {

        const file =
            this.files[0];

        if (!file) {

            currentImage = null;

            imagePreview.style.display =
                "none";

            imagePreview.innerHTML =
                "";

            return;
        }

        const reader =
            new FileReader();

        reader.onload =
            function (event) {

                currentImage =
                    event.target.result;

                imagePreview.innerHTML =
                    `<img src="${currentImage}" alt="Map image">`;

                imagePreview.style.display =
                    "block";
            };

        reader.readAsDataURL(file);
    }
);


/* =========================================================
   MARKDOWN PARSER
========================================================= */

function parseMarkdown(markdown) {

    const lines =
        markdown
            .replace(/\r\n/g, "\n")
            .split("\n");

    let root =
        null;

    const stack =
        [];

    for (
        let rawLine of lines
    ) {

        const line =
            rawLine.replace(
                /\t/g,
                "    "
            );

        if (!line.trim()) {
            continue;
        }


        /* -------------------------------------------------
           Heading
        ------------------------------------------------- */

        const headingMatch =
            line.match(
                /^(#{1,6})\s+(.+)$/
            );

        if (headingMatch) {

            const level =
                headingMatch[1].length;

            const title =
                headingMatch[2].trim();

            const node = {

                title:
                    title,

                level:
                    level,

                type:
                    "heading",

                children:
                    [],

                collapsed:
                    false
            };


            if (
                level === 1 ||
                !root
            ) {

                if (!root) {
                    root = node;
                }

                stack.length =
                    0;

                stack.push(node);

                continue;
            }


            while (
                stack.length > 0 &&
                stack[
                    stack.length - 1
                ].level >= level
            ) {

                stack.pop();
            }


            const parent =
                stack[
                    stack.length - 1
                ];


            if (parent) {

                parent.children.push(
                    node
                );

                stack.push(
                    node
                );
            }

            continue;
        }


        /* -------------------------------------------------
           Bullet
        ------------------------------------------------- */

        const bulletMatch =
            line.match(
                /^\s*[-*+]\s+(.+)$/
            );

        if (bulletMatch) {

            const node = {

                title:
                    bulletMatch[1].trim(),

                level:
                    null,

                type:
                    "detail",

                children:
                    [],

                collapsed:
                    false
            };


            const parent =
                stack[
                    stack.length - 1
                ];


            if (parent) {

                parent.children.push(
                    node
                );
            }
        }
    }

    return root;
}


/* =========================================================
   BRANCH COLORS
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


    let branch =
        node;


    while (
        branch.parent &&
        branch.parent.depth > 0
    ) {

        branch =
            branch.parent;
    }


    if (
        branch.parent &&
        branch.parent.children
    ) {

        const index =
            branch.parent.children.indexOf(
                branch
            );


        return colors[
            index % colors.length
        ];
    }


    return colors[0];
}


/* =========================================================
   NODE DIMENSIONS
========================================================= */

function nodeWidth(d) {

    if (d.depth === 0) {
        return 330;
    }

    if (d.depth === 1) {
        return 270;
    }

    if (d.depth === 2) {
        return 230;
    }

    return 205;
}


function nodeHeight(d) {

    if (d.depth === 0) {
        return 125;
    }

    if (d.depth === 1) {
        return 76;
    }

    if (d.depth === 2) {
        return 60;
    }

    return 50;
}


/* =========================================================
   TEXT WRAPPING
========================================================= */

function wrapNodeText(
    selection,
    width
) {

    selection.each(
        function (d) {

            const text =
                d3.select(this);

            const words =
                d.data.title
                    .split(/\s+/)
                    .reverse();

            let word;

            let line = [];

            let lineNumber = 0;

            const lineHeight =
                d.depth === 0
                    ? 25
                    : d.depth === 1
                        ? 20
                        : 17;

            const y =
                0;

            const x =
                0;

            let tspan =
                text
                    .text(null)
                    .append("tspan")
                    .attr(
                        "x",
                        x
                    )
                    .attr(
                        "y",
                        y
                    )
                    .attr(
                        "dy",
                        "0em"
                    );


            while (
                (word = words.pop())
            ) {

                line.push(word);

                tspan.text(
                    line.join(" ")
                );


                if (
                    tspan.node()
                        .getComputedTextLength()
                    >
                    width
                ) {

                    line.pop();

                    tspan.text(
                        line.join(" ")
                    );

                    line = [
                        word
                    ];

                    lineNumber++;

                    tspan =
                        text
                            .append("tspan")
                            .attr(
                                "x",
                                x
                            )
                            .attr(
                                "y",
                                y
                            )
                            .attr(
                                "dy",
                                `${lineHeight}px`
                            )
                            .text(
                                word
                            );
                }
            }


            /*
               Centre multiple lines.
            */

            const tspans =
                text.selectAll("tspan");


            const totalHeight =
                (tspans.size() - 1) *
                lineHeight;


            tspans.each(
                function (
                    unused,
                    i
                ) {

                    d3.select(this)
                        .attr(
                            "dy",
                            i === 0
                                ? `${-totalHeight / 2}px`
                                : `${lineHeight}px`
                        );
                }
            );
        }
    );
}


/* =========================================================
   RENDER MIND MAP
========================================================= */

function renderMindMap(
    tree,
    fitAfterRender = false
) {

    /*
       Preserve camera position.
    */

    const previousTransform =
        d3.zoomTransform(
            svg.node()
        );


    svg.selectAll("*").remove();


    if (!tree) {
        return;
    }


    /* =====================================================
       SVG SIZE
    ===================================================== */

    const width =
        svg.node().clientWidth;

    const height =
        svg.node().clientHeight;


    const xOffset =
        width / 2;

    const yOffset =
        height / 2;


    /* =====================================================
       MAIN CONTAINER
    ===================================================== */

    const container =
        svg.append("g")
            .attr(
                "class",
                "map-container"
            );


    /* =====================================================
       ZOOM
    ===================================================== */

    zoomBehaviour =
        d3.zoom()

            .scaleExtent([
                0.25,
                3
            ])

            .on(
                "zoom",
                event => {

                    container.attr(
                        "transform",
                        event.transform
                    );
                }
            );


    svg.call(
        zoomBehaviour
    );


    /*
       Restore camera when expanding/
       collapsing a branch.
    */

    if (!fitAfterRender) {

        svg.call(
            zoomBehaviour.transform,
            previousTransform
        );
    }


    /* =====================================================
       HIERARCHY
    ===================================================== */

    root =
        d3.hierarchy(
            tree,
            node => {

                if (
                    node.collapsed
                ) {

                    return null;
                }

                return node.children;
            }
        );


    /* =====================================================
       TREE LAYOUT
    ===================================================== */

    const layout =
        d3.tree()
            .nodeSize([
                125,
                300
            ]);


    layout(root);


    /* =====================================================
       KEEP ROOT ANCHORED
    ===================================================== */

    const rootX =
        root.x;


    root.each(
        function (d) {

            d.x =
                d.x - rootX;
        }
    );


    /* =====================================================
       ROOT GAP
    ===================================================== */

    const minimumRootGap =
        90;


    if (root.children) {

        root.children.forEach(
            function (child) {

                if (
                    Math.abs(child.x) <
                    minimumRootGap
                ) {

                    const shift =
                        child.x >= 0
                            ? minimumRootGap
                            : -minimumRootGap;


                    child.each(
                        function (d) {

                            d.x +=
                                shift;
                        }
                    );
                }
            }
        );
    }


    /* =====================================================
       LINKS
    ===================================================== */

    const linkGroup =
        container
            .append("g")
            .attr(
                "class",
                "links"
            );


    linkGroup
        .selectAll("path")
        .data(
            root.links()
        )
        .join("path")

        .attr(
            "class",
            "map-link"
        )

        .attr(
            "fill",
            "none"
        )

        .attr(
            "stroke",
            d => {

                if (
                    d.target.depth === 1
                ) {

                    return branchColor(
                        d.target
                    );
                }

                return "#c4c7ca";
            }
        )

        .attr(
            "stroke-width",
            d => {

                if (
                    d.target.depth === 1
                ) {

                    return 4;
                }

                if (
                    d.target.depth === 2
                ) {

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
            d => {

                const sourceWidth =
                    nodeWidth(
                        d.source
                    );

                const targetWidth =
                    nodeWidth(
                        d.target
                    );


                const sourceX =
                    d.source.y +
                    xOffset +
                    sourceWidth / 2;


                const targetX =
                    d.target.y +
                    xOffset -
                    targetWidth / 2;


                return `
                    M ${sourceX},${d.source.x + yOffset}
                    C ${(sourceX + targetX) / 2},${d.source.x + yOffset}
                      ${(sourceX + targetX) / 2},${d.target.x + yOffset}
                      ${targetX},${d.target.x + yOffset}
                `;
            }
        );


    /* =====================================================
       NODE GROUP
    ===================================================== */

    const nodeGroup =
        container
            .append("g")
            .attr(
                "class",
                "nodes"
            );


    const nodes =
        nodeGroup

            .selectAll("g")

            .data(
                root.descendants()
            )

            .join("g")

            .attr(
                "class",
                d => {

                    if (d.depth === 0) {
                        return "mind-node root-node";
                    }

                    if (d.depth === 1) {
                        return "mind-node major-node";
                    }

                    if (d.depth === 2) {
                        return "mind-node secondary-node";
                    }

                    return "mind-node detail-node";
                }
            )

            .attr(
                "transform",
                d =>
                    `translate(
                        ${d.y + xOffset},
                        ${d.x + yOffset}
                    )`
            );


    /* =====================================================
       NODE CARDS
    ===================================================== */

    nodes
        .append("rect")

        .attr(
            "class",
            "node-card"
        )

        .attr(
            "x",
            d =>
                -nodeWidth(d) / 2
        )

        .attr(
            "y",
            d =>
                -nodeHeight(d) / 2
        )

        .attr(
            "width",
            d =>
                nodeWidth(d)
        )

        .attr(
            "height",
            d =>
                nodeHeight(d)
        )

        .attr(
            "rx",
            d =>
                d.depth === 0
                    ? 22
                    : 15
        )

        .attr(
            "ry",
            d =>
                d.depth === 0
                    ? 22
                    : 15
        )

        .attr(
            "fill",
            d =>
                d.depth === 0
                    ? "#ffffff"
                    : "#ffffff"
        )

        .attr(
            "stroke",
            d => {

                if (
                    d.depth === 0
                ) {

                    return "#20242a";
                }

                if (
                    d.depth === 1
                ) {

                    return branchColor(d);
                }

                return "#d5d8dc";
            }
        )

        .attr(
            "stroke-width",
            d => {

                if (
                    d.depth === 0
                ) {

                    return 3;
                }

                if (
                    d.depth === 1
                ) {

                    return 2.5;
                }

                return 1.5;
            }
        );


    /* =====================================================
       MAJOR BRANCH ACCENT
    ===================================================== */

    nodes
        .filter(
            d =>
                d.depth === 1
        )

        .append("rect")

        .attr(
            "class",
            "node-accent"
        )

        .attr(
            "x",
            d =>
                -nodeWidth(d) / 2
        )

        .attr(
            "y",
            d =>
                -nodeHeight(d) / 2
        )

        .attr(
            "width",
            7
        )

        .attr(
            "height",
            d =>
                nodeHeight(d)
        )

        .attr(
            "rx",
            3.5
        )

        .attr(
            "fill",
            d =>
                branchColor(d)
        );


    /* =====================================================
       NODE TEXT
    ===================================================== */

    const nodeText =
        nodes

            .append("text")

            .attr(
                "class",
                d => {

                    if (
                        d.depth === 0
                    ) {

                        return "node-title root-title";
                    }

                    if (
                        d.data.type ===
                        "detail"
                    ) {

                        return "node-detail";
                    }

                    return "node-title";
                }
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
                d => {

                    if (
                        d.depth === 0
                    ) {

                        return "24px";
                    }

                    if (
                        d.depth === 1
                    ) {

                        return "17px";
                    }

                    if (
                        d.depth === 2
                    ) {

                        return "14px";
                    }

                    return "12px";
                }
            )

            .attr(
                "font-weight",
                d =>
                    d.depth <= 1
                        ? 700
                        : 400
            )

            .attr(
                "fill",
                d => {

                    if (
                        d.depth === 0
                    ) {

                        return "#20242a";
                    }

                    if (
                        d.data.type ===
                        "detail"
                    ) {

                        return "#62676d";
                    }

                    return "#252a30";
                }
            );


    wrapNodeText(
        nodeText,
        d => nodeWidth(d) - 38
    );


    /* =====================================================
       EXPAND / COLLAPSE
    ===================================================== */

    const expandable =
        nodes.filter(
            d =>
                d.data.children &&
                d.data.children.length > 0
        );


    /* -----------------------------------------------------
       Expand button
    ----------------------------------------------------- */

    expandable

        .append("circle")

        .attr(
            "class",
            "expand-button"
        )

        .attr(
            "cx",
            d =>
                nodeWidth(d) / 2 - 19
        )

        .attr(
            "cy",
            d =>
                -nodeHeight(d) / 2 + 19
        )

        .attr(
            "r",
            12
        )

        .attr(
            "fill",
            "#ffffff"
        )

        .attr(
            "stroke",
            d =>
                branchColor(d)
        )

        .attr(
            "stroke-width",
            2
        );


    /* -----------------------------------------------------
       Plus / minus
    ----------------------------------------------------- */

    expandable

        .append("text")

        .attr(
            "class",
            "expand-symbol"
        )

        .attr(
            "x",
            d =>
                nodeWidth(d) / 2 - 19
        )

        .attr(
            "y",
            d =>
                -nodeHeight(d) / 2 + 20
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
            d =>
                branchColor(d)
        )

        .text(
            d =>
                d.data.collapsed
                    ? "+"
                    : "−"
        );


    /* =====================================================
       ROOT IMAGE
    ===================================================== */

    if (currentImage) {

        const rootNode =
            nodes.filter(
                d =>
                    d.depth === 0
            );


        rootNode

            .append("clipPath")

            .attr(
                "id",
                "root-image-clip"
            )

            .append("rect")

            .attr(
                "x",
                -nodeWidth(root) / 2 + 14
            )

            .attr(
                "y",
                -nodeHeight(root) / 2 + 14
            )

            .attr(
                "width",
                70
            )

            .attr(
                "height",
                nodeHeight(root) - 28
            )

            .attr(
                "rx",
                12
            );


        rootNode

            .append("image")

            .attr(
                "href",
                currentImage
            )

            .attr(
                "class",
                "root-image"
            )

            .attr(
                "x",
                -nodeWidth(root) / 2 + 14
            )

            .attr(
                "y",
                -nodeHeight(root) / 2 + 14
            )

            .attr(
                "width",
                70
            )

            .attr(
                "height",
                nodeHeight(root) - 28
            )

            .attr(
                "preserveAspectRatio",
                "xMidYMid slice"
            )

            .attr(
                "clip-path",
                "url(#root-image-clip)"
            );
    }


    /* =====================================================
       CLICK TO EXPAND / COLLAPSE
    ===================================================== */

    expandable.on(
        "click",
        function (
            event,
            d
        ) {

            event.stopPropagation();


            d.data.collapsed =
                !d.data.collapsed;


            renderMindMap(
                tree,
                false
            );
        }
    );


    /* =====================================================
       FIT
    ===================================================== */

    if (
        fitAfterRender
    ) {

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


    if (
        !container.node()
    ) {

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
            (
                bounds.width +
                180
            ),

            height /
            (
                bounds.height +
                180
            ),

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

                .translate(
                    x,
                    y
                )

                .scale(
                    scale
                )
        );
}


/* =========================================================
   ZOOM IN
========================================================= */

document
    .getElementById(
        "zoomInButton"
    )
    .addEventListener(
        "click",
        () => {

            if (!zoomBehaviour) {
                return;
            }


            svg.transition()
                .call(
                    zoomBehaviour.scaleBy,
                    1.25
                );
        }
    );


/* =========================================================
   ZOOM OUT
========================================================= */

document
    .getElementById(
        "zoomOutButton"
    )
    .addEventListener(
        "click",
        () => {

            if (!zoomBehaviour) {
                return;
            }


            svg.transition()
                .call(
                    zoomBehaviour.scaleBy,
                    0.8
                );
        }
    );


/* =========================================================
   FIT BUTTON
========================================================= */

document
    .getElementById(
        "fitButton"
    )
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
            parseMarkdown(
                markdown
            );


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


        renderMindMap(
            tree,
            true
        );
    }
);
