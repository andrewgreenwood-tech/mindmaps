/* =========================================================
   MIND MAP GENERATOR
   Version 5 — Stable Card Layout
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


        /* =================================================
           HEADINGS
        ================================================= */

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


            /* ---------------------------------------------
               ROOT
            --------------------------------------------- */

            if (
                level === 1 ||
                !root
            ) {

                if (!root) {
                    root = node;
                }

                stack.length =
                    0;

                stack.push(
                    node
                );

                continue;
            }


            /* ---------------------------------------------
               FIND PARENT
            --------------------------------------------- */

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


        /* =================================================
           BULLETS
        ================================================= */

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
   NODE WIDTH
========================================================= */

function nodeWidth(d) {

    if (d.depth === 0) {
        return 330;
    }


    if (d.depth === 1) {
        return 280;
    }


    if (d.depth === 2) {
        return 235;
    }


    return 205;
}


/* =========================================================
   NODE HEIGHT
========================================================= */

function nodeHeight(d) {

    if (d.depth === 0) {
        return 115;
    }


    if (d.depth === 1) {
        return 72;
    }


    if (d.depth === 2) {
        return 58;
    }


    return 48;
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


            const lineHeight =
                d.depth === 0
                    ? 25
                    : d.depth === 1
                        ? 19
                        : 16;


            const lines = [];


            while (
                (word = words.pop())
            ) {

                line.push(word);

                const test =
                    line.join(" ");


                /*
                   We cannot reliably measure text
                   before it is attached, so use a
                   conservative character estimate.
                */

                const estimatedWidth =
                    test.length *
                    (
                        d.depth === 0
                            ? 12
                            : d.depth === 1
                                ? 8.5
                                : 7
                    );


                if (
                    estimatedWidth > width &&
                    line.length > 1
                ) {

                    line.pop();

                    lines.push(
                        line.join(" ")
                    );

                    line = [
                        word
                    ];
                }
            }


            if (line.length) {

                lines.push(
                    line.join(" ")
                );
            }


            const totalHeight =
                (
                    lines.length - 1
                ) *
                lineHeight;


            text.text(null);


            lines.forEach(
                function (
                    lineText,
                    index
                ) {

                    text
                        .append("tspan")
                        .attr(
                            "x",
                            0
                        )
                        .attr(
                            "dy",
                            index === 0
                                ? `${-totalHeight / 2}px`
                                : `${lineHeight}px`
                        )
                        .text(
                            lineText
                        );
                }
            );
        }
    );
}


/* =========================================================
   RENDER
========================================================= */

function renderMindMap(
    tree,
    fitAfterRender = false
) {

    /*
       IMPORTANT:

       Keep the current camera when expanding
       or collapsing a branch.
    */

    const previousTransform =
        d3.zoomTransform(
            svg.node()
        );


    svg.selectAll("*").remove();


    if (!tree) {
        return;
    }


    const width =
        svg.node().clientWidth;


    const height =
        svg.node().clientHeight;


    /* =====================================================
       CONTAINER
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
                0.35,
                3
            ])

            .on(
                "zoom",
                function (event) {

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
       Restore previous camera after
       expand/collapse.
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
            function (node) {

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
                115,
                300
            ]);


    layout(root);


    /* =====================================================
       ANCHOR ROOT
    ===================================================== */

    /*
       D3 naturally puts the root around the middle
       of the vertical tree.

       We explicitly reset the root to y = 0 so
       it becomes our fixed reference point.
    */

    const rootX =
        root.x;


    root.each(
        function (d) {

            d.x =
                d.x - rootX;
        }
    );


    /* =====================================================
       FIRST LEVEL SPACING
    ===================================================== */

    if (root.children) {

        const children =
            root.children;


        const minimumSpacing =
            105;


        /*
           Sort the branches by their calculated
           vertical position.

           We do NOT change the Markdown order.
           This only affects their physical spacing.
        */

        children.sort(
            function (a, b) {

                return a.x - b.x;
            }
        );

         /* Move primary branches closer to the root */
         children.forEach(
             function (child) {
                 child.y -= 80;
         
                 child.each(
                     function (d) {
                         d.y -= 80;
                     }
                 );
             }
         );

        /*
           Push branches apart if they are too close.
        */

        for (
            let i = 1;
            i < children.length;
            i++
        ) {

            const previous =
                children[i - 1];

            const current =
                children[i];


            const gap =
                current.x -
                previous.x;


            if (
                gap < minimumSpacing
            ) {

                const shift =
                    minimumSpacing -
                    gap;


                current.each(
                    function (d) {

                        d.x +=
                            shift;
                    }
                );
            }
        }


        /*
           Re-centre the first-level group around
           the root without moving the root.
        */

        const first =
            children[0];

        const last =
            children[
                children.length - 1
            ];


        const groupCenter =
            (
                first.x +
                last.x
            ) / 2;


        const adjustment =
            -groupCenter;


        children.forEach(
            function (child) {

                child.each(
                    function (d) {

                        d.x +=
                            adjustment;
                    }
                );
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
            function (d) {

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
            function (d) {

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
            function (d) {

                const sourceRight =
                    d.source.y +
                    nodeWidth(d.source) / 2;


                const targetLeft =
                    d.target.y -
                    nodeWidth(d.target) / 2;


                const x1 =
                    sourceRight;


                const x2 =
                    targetLeft;


                const middle =
                    (
                        x1 +
                        x2
                    ) / 2;


                return `
                    M ${x1},${d.source.x}
                    C ${middle},${d.source.x}
                      ${middle},${d.target.x}
                      ${x2},${d.target.x}
                `;
            }
        );


    /* =====================================================
       NODES
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
                function (d) {

                    if (
                        d.depth === 0
                    ) {

                        return "mind-node root-node";
                    }


                    if (
                        d.depth === 1
                    ) {

                        return "mind-node major-node";
                    }


                    if (
                        d.depth === 2
                    ) {

                        return "mind-node secondary-node";
                    }


                    return "mind-node detail-node";
                }
            )

            .attr(
                "transform",
                function (d) {

                    return `
                        translate(
                            ${d.y},
                            ${d.x}
                        )
                    `;
                }
            );


    /* =====================================================
       NODE CARD
    ===================================================== */

    nodes

        .append("rect")

        .attr(
            "class",
            "node-card"
        )

        .attr(
            "x",
            function (d) {

                return -
                    nodeWidth(d) /
                    2;
            }
        )

        .attr(
            "y",
            function (d) {

                return -
                    nodeHeight(d) /
                    2;
            }
        )

        .attr(
            "width",
            function (d) {

                return nodeWidth(d);
            }
        )

        .attr(
            "height",
            function (d) {

                return nodeHeight(d);
            }
        )

        .attr(
            "rx",
            function (d) {

                return d.depth === 0
                    ? 20
                    : 14;
            }
        )

        .attr(
            "ry",
            function (d) {

                return d.depth === 0
                    ? 20
                    : 14;
            }
        )

        .attr(
            "fill",
            "#ffffff"
        )

        .attr(
            "stroke",
            function (d) {

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


                return "#d3d6da";
            }
        )

        .attr(
            "stroke-width",
            function (d) {

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
       COLOURED ACCENT
    ===================================================== */

    nodes

        .filter(
            function (d) {

                return d.depth === 1;
            }
        )

        .append("rect")

        .attr(
            "class",
            "node-accent"
        )

        .attr(
            "x",
            function (d) {

                return -
                    nodeWidth(d) /
                    2;
            }
        )

        .attr(
            "y",
            function (d) {

                return -
                    nodeHeight(d) /
                    2;
            }
        )

        .attr(
            "width",
            7
        )

        .attr(
            "height",
            function (d) {

                return nodeHeight(d);
            }
        )

        .attr(
            "rx",
            3
        )

        .attr(
            "fill",
            function (d) {

                return branchColor(d);
            }
        );


    /* =====================================================
       TEXT
    ===================================================== */

    const nodeText =
        nodes

            .append("text")

            .attr(
                "class",
                function (d) {

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
                function (d) {

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
                function (d) {

                    return d.depth <= 1
                        ? 700
                        : 400;
                }
            )

            .attr(
                "fill",
                function (d) {

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
        200
    );


    /* =====================================================
       EXPAND / COLLAPSE
    ===================================================== */

    const expandable =
        nodes.filter(
            function (d) {

                return (
                    d.data.children &&
                    d.data.children.length > 0
                );
            }
        );


    /* =====================================================
       CONTROL CIRCLE
    ===================================================== */

    expandable

        .append("circle")

        .attr(
            "class",
            "expand-button"
        )

        .attr(
            "cx",
            function (d) {

                return (
                    nodeWidth(d) /
                    2 -
                    18
                );
            }
        )

        .attr(
            "cy",
            function (d) {

                return (
                    -
                    nodeHeight(d) /
                    2 +
                    18
                );
            }
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
            function (d) {

                return branchColor(d);
            }
        )

        .attr(
            "stroke-width",
            2
        );


    /* =====================================================
       PLUS / MINUS
    ===================================================== */

    expandable

        .append("text")

        .attr(
            "class",
            "expand-symbol"
        )

        .attr(
            "x",
            function (d) {

                return (
                    nodeWidth(d) /
                    2 -
                    18
                );
            }
        )

        .attr(
            "y",
            function (d) {

                return (
                    -
                    nodeHeight(d) /
                    2 +
                    19
                );
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
            "13px"
        )

        .attr(
            "font-weight",
            "700"
        )

        .attr(
            "fill",
            function (d) {

                return branchColor(d);
            }
        )

        .text(
            function (d) {

                return d.data.collapsed
                    ? "+"
                    : "−";
            }
        );


    /* =====================================================
       ROOT IMAGE
    ===================================================== */

    if (currentImage) {

        const rootNode =
            nodes.filter(
                function (d) {

                    return d.depth === 0;
                }
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
                -
                nodeWidth(root) /
                2 +
                14
            )

            .attr(
                "y",
                -
                nodeHeight(root) /
                2 +
                14
            )

            .attr(
                "width",
                70
            )

            .attr(
                "height",
                nodeHeight(root) -
                28
            )

            .attr(
                "rx",
                10
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
                -
                nodeWidth(root) /
                2 +
                14
            )

            .attr(
                "y",
                -
                nodeHeight(root) /
                2 +
                14
            )

            .attr(
                "width",
                70
            )

            .attr(
                "height",
                nodeHeight(root) -
                28
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
       CLICK
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
       INITIAL FIT
    ===================================================== */

    if (
        fitAfterRender
    ) {

        setTimeout(
            function () {

                fitMap();

            },
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


    const width =
        svg.node().clientWidth;


    const height =
        svg.node().clientHeight;


    /*
       We intentionally do NOT centre the entire
       bounding box.

       A mind map should keep the root near the
       left/centre and let the branches spread
       towards the right.
    */

    const rootX =
        root.y;


    const bounds =
        container
            .node()
            .getBBox();


    const leftSpace =
        rootX -
        bounds.x;


    const rightSpace =
        bounds.x +
        bounds.width -
        rootX;


    const verticalSpace =
        Math.max(
            Math.abs(bounds.y),
            Math.abs(
                bounds.y +
                bounds.height
            )
        );


    /*
       Leave generous space around the map.
    */

    const horizontalScale =
        (
            width *
            0.88
        ) /
        (
            leftSpace +
            rightSpace +
            120
        );


    const verticalScale =
        (
            height *
            0.88
        ) /
        (
            bounds.height +
            100
        );


    /*
       Keep the initial map readable.

       We don't want Fit Map to reduce everything
       to tiny text just because one branch is long.
    */

    let scale =
        Math.min(
            horizontalScale,
            verticalScale
        );


    scale =
        Math.max(
            scale,
            0.65
        );


    scale =
        Math.min(
            scale,
            1.15
        );


    /*
       Put the root approximately 30% from
       the left edge of the visible map.
    */

    const desiredRootX =
        width *
        0.30;


    const desiredRootY =
        height *
        0.50;


    const translateX =
        desiredRootX -
        (
            rootX *
            scale
        );


    const translateY =
        desiredRootY;


    svg.transition()

        .duration(450)

        .call(
            zoomBehaviour.transform,

            d3.zoomIdentity

                .translate(
                    translateX,
                    translateY
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
        function () {

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
        function () {

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
        function () {

            fitMap();
        }
    );


/* =========================================================
   GENERATE
========================================================= */

generateButton.addEventListener(
    "click",
    function () {

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
